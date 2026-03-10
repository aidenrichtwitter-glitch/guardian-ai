// #region Imports
import React, { useEffect, useState } from "react"
import { pushData, shift } from "../../../../../features/arrays/arraysSlice"
import { changeGridCellStatus, clearGridCellsStatus, copyGrids, floodFillFromInputWithQueue} from "../../../../../features/grids/gridsSlice"
import { ARRAY_2D_GET_FOUR_DIRECTIONS_FROM_CELL } from "../gridUtils"
import { useAppDispatch, useAppSelector } from "../../../../../features/hooks"
import { pushJSXToLog } from "../../../../../features/problemInfo/problemSlice"
import { addArray, deleteArray } from "../../../../../features/sharedActions"
import { QUESTIONS_ENUM } from "../../../../../utils/questionEnum"
import { useGetGridFromProblemExampleLazyQuery } from "../../../../../__generated__/resolvers-types"
import { BasicController } from "../../BasicController"
import {ControllerProps} from "../../controllerUtils"
import { clearState } from "../../../../../utils/clearState"
import { convertArrayToGrid, createStringFromCurrentCell, iterateToNextCell, parseCurrentCellFromString } from "../gridControllerUtils"
import { GridCreationLog, LengthEdgeCaseLog} from "../logUtils"
import { WithBasicGridClient } from "../WithBasicGridClient"
import { WithBasicGridClientInjectedProps } from "../../clientHOCProps"

//#endregion

type NumberCell = [number, number];

const TEMPLATE_ShortestBridgeController = ({
  animationOn, play, pause, animationSpeed,
  setup, problemNumber, setComplete, complete
}: WithBasicGridClientInjectedProps) => {
  /* Redux State variables */
  const dispatch = useAppDispatch();
  const grid = useAppSelector(state => state.grids[0] ? state.grids[0].cells : []);
  const queue = useAppSelector(state => state.arrays[0] ? state.arrays[0].data: []);
  const logLength = useAppSelector(state => state.problem.problemLog.length);
  /* Local state variables */
  const [currentCell, setCurrentCell] = useState<NumberCell>([0, 0]);
  const [bridgeLength, setBridgeLength] = useState<number>(0);

  /* Setup Function */
  const clickSetUp = async () => {
    setup();
    setBridgeLength(0);
  }

  const clickStep = () => {
    if (complete) {
      return;
    }
    //Check for Edge Cases
    if (grid.length === 2) {
      if (logLength !== 2) {
        dispatch(pushJSXToLog({element: LengthEdgeCaseLog(dispatch)}));
      }
      return;
    }

    if (queue.length !== 0) {
      //Increment bridge length
      setBridgeLength(bridgeLength + 1);
      const cellStringData = queue.map((ele) => ele.data);
      for (let i = 0; i < queue.length; i++) {
        const cell = parseCurrentCellFromString(queue[i].data as string);
        //BFS from current cell, no negatives
        const bfsCells = ARRAY_2D_GET_FOUR_DIRECTIONS_FROM_CELL(cell, grid);
        //Parse cells found in bfs
        for (let i = 0; i < bfsCells.length; i++) {
          const newCellString = createStringFromCurrentCell(bfsCells[i]);
          //If the cell we found already exists in the queue, continue early
          if (cellStringData.find((cellString) => cellString === newCellString) !== undefined) {
            continue;
          }
          const newRow = bfsCells[i][0];
          const newCol = bfsCells[i][1];
          if (grid[newRow][newCol].data === 1) {
            dispatch(clearGridCellsStatus({gridIndex: 0, defaultStatus: "UNEXPLORED"}));
            dispatch(changeGridCellStatus({gridIndex: 0, row: newRow, col: newCol, status: "CURRENT"}));
            dispatch(deleteArray({num: 1, arraysLength: 1}));
            setComplete(true);
            const element: JSX.Element = (
              <p>
                {`Second island found! Length of shortest bridge is `}
                <b>{bridgeLength}</b>
              </p>
            )
            dispatch(pushJSXToLog({element: element}));
            return;
          }
          dispatch(changeGridCellStatus({gridIndex: 0, row: bfsCells[i][0], col: bfsCells[i][1], status: "CURRENT"}));
          dispatch(pushData({arrayIndex: 0, data: [newCellString]}));
          cellStringData.push(newCellString);
        }
      }
      for (let i = 0; i < queue.length; i++) {
        const cell = parseCurrentCellFromString(queue[i].data as string);
        dispatch(changeGridCellStatus({gridIndex: 0, row: cell[0], col: cell[1], status: "UNEXPLORED"}));
        dispatch(shift({arrayIndex: 0}));
      }
      const element: JSX.Element = (
        <p>
          Breath first search from cells in queue and increment length of bridge.
        </p>
      )
      dispatch(pushJSXToLog({element: element}));
      return;
    }

    const i = currentCell[0];
    const j = currentCell[1];
    const curTileValue = grid[i][j].data


    if (curTileValue === 1 && queue.length === 0) {
      dispatch(addArray({num: 1}));
      dispatch(floodFillFromInputWithQueue(
        0,
        currentCell,
        1,
        0,
        "CURRENT"
      ));
      dispatch(shift({arrayIndex: 0}));
      const element: JSX.Element = (
        <p>
          Flood Fill first island and push its cells into queue.
        </p>
      );
      dispatch(pushJSXToLog({element: element}));
      return;
    }

    if (curTileValue === 0) {
        //Clear current cell
      dispatch(changeGridCellStatus({
        gridIndex: 0,
        row: i,
        col: j,
        status: "UNEXPLORED"
      }));
      const [nextI, nextJ] = iterateToNextCell(dispatch, grid, currentCell);
      setCurrentCell([nextI, nextJ]);
      const element = (<p>Iterate through grid to find the first island.</p>);
      dispatch(pushJSXToLog({element: element}));
      return;
    }
  }

  //If playing and the current context changes, click step again.
  useEffect(() => {
    if (animationOn && problemNumber === QUESTIONS_ENUM.SHORTEST_BRIDGE) {
      setTimeout(() => clickStep(), animationSpeed);
    }
  }, [animationOn]); //curentContext to array


  return (
    <BasicController problemNumber={problemNumber}
      label={"Label For Shortest Bridge Problem"}
      play={() => {
        if (problemNumber !== QUESTIONS_ENUM.SHORTEST_BRIDGE) {
          clickSetUp();
        }
        play();
      }}
      setup={clickSetUp}
      pause={pause}
      step={clickStep}
    />
  )
}

export const ShortestBridgeController = 
  WithBasicGridClient(TEMPLATE_ShortestBridgeController, "Shortest Bridge Grid");