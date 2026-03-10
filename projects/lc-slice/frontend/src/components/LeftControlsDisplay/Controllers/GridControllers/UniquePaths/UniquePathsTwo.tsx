import { useAppDispatch, useAppSelector } from "../../../../../features/hooks";
import React, {useState, useEffect} from "react"
import { BasicController } from "../../BasicController";
import { QUESTIONS_ENUM } from "../../../../../utils/questionEnum";
import { iterateToNextCell } from "../gridControllerUtils";
import { changeGridCellData, changeGridCellStatus } from "../../../../../features/grids/gridsSlice";
import { collectSumOfPreviousCells, setPrevEvaluatedCells, UniquePathsInitialCellSetup } from "./uniquePathsHelpers";
import {ARRAY_2D_GET_TWO_DIRECTIONS_FROM_CELL } from "../gridUtils";
import { pushJSXToLog } from "../../../../../features/problemInfo/problemSlice";
import { CellHighlighter } from "../../CellHighlighter";
import { WithBasicGridClient } from "../WithBasicGridClient";
import { WithBasicGridClientInjectedProps } from "../../clientHOCProps";


const TEMPLATE_UniquePathsTwoController = ({
  animationOn, play, pause, animationSpeed,
  complete, setComplete, problemNumber, setup
}: WithBasicGridClientInjectedProps) => {
  /* Global State Variables */
  const dispatch = useAppDispatch();
  const grid = useAppSelector(state => state.grids[0] ? state.grids[0].cells : []);
  /* Client State Variables */
  const [currentCell, setCurrentCell] = useState<[number, number]>([0, 0]);

  const clickSetUp = async () => {
    setup();
    setCurrentCell([0, 0]);
  }

  const clickStep = () => {
    if (complete) {
      return;
    }
    //Store current row and column values
    const row = currentCell[0];
    const col = currentCell[1];
    //Default value for first cell;
    if (row === 0 && col === 0) {
      const nextCell = UniquePathsInitialCellSetup(dispatch, currentCell, grid);
      setCurrentCell(nextCell);
      return;
    }
    
    //Compute value of current cell
    let sum = 0;
    let prevOfCurrent = ARRAY_2D_GET_TWO_DIRECTIONS_FROM_CELL(currentCell, "BEHIND", grid);
    if (grid[row][col].data === 1) {
      for (let i = 0; i < prevOfCurrent.length; i++) {
        dispatch(changeGridCellStatus({
          gridIndex: 0,
          row: prevOfCurrent[i][0],
          col: prevOfCurrent[i][1],
          status: "UNEXPLORED"
        }));
      }
      dispatch(changeGridCellData({
        gridIndex: 0,
        row: row,
        col: col,
        data: sum
      }));
      const element = (
        <p>
          {`Encountered obstacle at cell`}
          <CellHighlighter dispatch={dispatch} cell={currentCell}/>
          {`and set it's value to 0.`}
        </p>
      );
      dispatch(pushJSXToLog({element: element}));
    } else {
      sum = collectSumOfPreviousCells(dispatch, prevOfCurrent, grid);
      dispatch(changeGridCellData({
        gridIndex: 0,
        row: row,
        col: col,
        data: sum
      }))
      const element = (
        <p>
          {`Added values from above and left to current cell.`}
          <CellHighlighter dispatch={dispatch} cell={currentCell}/>
        </p>
      );
      dispatch(pushJSXToLog({element: element}));
    }
    const nextCell = iterateToNextCell(dispatch, grid, currentCell, true);
    setCurrentCell(nextCell);
    if (nextCell[0] === 0 && nextCell[1] === 0) {
      setComplete(true);
      pause();
      const element = (
        <p>
          {`Finished grid search. Final number of paths is ${sum}`}
        </p>
      )
      dispatch(pushJSXToLog({element: element}));
      return;
    }
    setPrevEvaluatedCells(dispatch, nextCell, grid);
  }

  useEffect(() => {
    if (animationOn && problemNumber === QUESTIONS_ENUM.UNIQUE_PATHS_II) {
      setTimeout(() => clickStep(), animationSpeed);
    }
  }, [currentCell, animationOn]);

  return (
    <BasicController problemNumber={problemNumber} play={() => {
        if (problemNumber !== QUESTIONS_ENUM.UNIQUE_PATHS_II) {
          clickSetUp();
        }
        play();
      }}
      label={"Unique Paths II"} setup={clickSetUp} step={clickStep} pause={pause}
    />
  );
}

export const UniquePathsTwoController = 
  WithBasicGridClient(TEMPLATE_UniquePathsTwoController, "Unique Paths II Grid");