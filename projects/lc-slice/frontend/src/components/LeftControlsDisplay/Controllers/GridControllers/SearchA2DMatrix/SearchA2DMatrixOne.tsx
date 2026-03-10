import React, {useState, useEffect} from "react"
import { useAppDispatch, useAppSelector } from "../../../../../features/hooks";
import { QUESTIONS_ENUM } from "../../../../../utils/questionEnum";
import { changeGridCellStatus } from "../../../../../features/grids/gridsSlice";
import { BasicController } from "../../BasicController";
import {WithBasicGridClient } from "../WithBasicGridClient"
import { iterateToNextCell, iterateToPreviousCell } from "../gridControllerUtils";
import { WithBasicGridClientInjectedProps } from "../../clientHOCProps";

const TEMPLATE_SearchA2DMatrixIController = ({
  animationOn, play, pause, animationSpeed,
  problemNumber, client, setup, setComplete, complete
}: WithBasicGridClientInjectedProps) => {
  const dispatch = useAppDispatch();
  const grid = useAppSelector(state => state.grids[0] ? state.grids[0].cells : []);
  /* Client State Variables */
  const [start, setStart] = useState<boolean>(false);
  const [target, setTarget] = useState<number>(144);
  const [iteration, setIteration] = useState<number>(0);
  const [targetRow, setTargetRow] = useState<number>(-1);

  const clickSetUp = async () => {
    setup();
    setIteration(0);
    setTargetRow(-1);
    setStart(false);
  }

  const getRowPointers = (
    targetRow: number, 
    iteration: number
  ) => {
    let firstPointer = grid[targetRow][iteration + 1].data;
    let secondPointer = grid[targetRow][grid[0].length - 1 - iteration].data;
    return [firstPointer, secondPointer]
  }

  const applyNextPointers = (
    targetRow: number,
    iteration: number,
  ) => {
    const leftCell: [number, number] = [targetRow, 0 + iteration];
    const rightCell: [number, number] = [targetRow, grid[0].length - 1 - iteration];
    console.log(`Setting columns ${leftCell[1]} & ${rightCell[1]} to Unexplored`)
    iterateToNextCell(dispatch, grid, leftCell);
    iterateToPreviousCell(dispatch, grid, rightCell);
  }

  const clickStep = () => {
    if (complete) {
      console.log("complete")
      return;
    }
    if (!start) {
      setStart(true);
      dispatch(changeGridCellStatus({gridIndex: 0, row: 0, col: 0, status: "CURRENT"}))
      setComplete(false);
      return;
    }

    //Define edge cases
    if (target < grid[0][0].data || target > grid[grid.length - 1][grid[0].length - 1].data) {
      setComplete(true);
      return;
    }

    //Emulate for loop
    if (targetRow === -1) {
      dispatch(changeGridCellStatus({
        gridIndex: 0,
        row: iteration,
        col: 0,
        status: "UNEXPLORED"   
      }));
      if (grid[iteration][0].data > target) {
        dispatch(changeGridCellStatus({
          gridIndex: 0,
          row: iteration - 1, 
          col: 0, 
          status: "CURRENT"
        }))
        dispatch(changeGridCellStatus({
          gridIndex: 0, 
          row: iteration - 1, 
          col: grid[0].length - 1,
          status: "CURRENT"
        }))
        setTargetRow(iteration - 1);
        setIteration(0);
        return;
      }

      if (grid[iteration][0].data === target) {
        setComplete(true);
        console.log("complete")
      }

      if (iteration === grid.length - 1) {
        console.log("s")
        setTargetRow(iteration)
        setIteration(0);
        dispatch(changeGridCellStatus({
          gridIndex: 0,
          row: iteration, 
          col: 0, 
          status: "CURRENT"
        }))
        dispatch(changeGridCellStatus({
          gridIndex: 0,
          row: iteration,
          col: grid[0].length - 1,
          status: "CURRENT"
        }))
        return;
      }

      dispatch(changeGridCellStatus({
        gridIndex: 0,
        row: iteration + 1,
        col: 0,
        status: "CURRENT"
      }))
      setIteration(iteration + 1);
      return;
    }

    const [firstPointer, secondPointer] = getRowPointers(targetRow, iteration)
    if (firstPointer === target || secondPointer === target) {
      applyNextPointers(targetRow, iteration);
      setComplete(true);
    }
    applyNextPointers(targetRow, iteration);
    setIteration(iteration + 1);
  }

  useEffect(() => {
    if (animationOn && problemNumber === QUESTIONS_ENUM.SEARCH_A_2D_MATRIX) {
      setTimeout(() => clickStep(), animationSpeed);
    }
  }, [start, iteration, animationOn]);

  return (
    <BasicController problemNumber={problemNumber}
      label={"Search a 2D Matrix"}
      setup={clickSetUp}
      step={clickStep}
      pause={pause}
      play={() => {
          if (problemNumber !== QUESTIONS_ENUM.SEARCH_A_2D_MATRIX) {
              clickSetUp();
          }
          play();
      }}
    />
  );
}

export const SearchA2DMatrixIController = 
  WithBasicGridClient(TEMPLATE_SearchA2DMatrixIController, "Search Matrix Grid")

