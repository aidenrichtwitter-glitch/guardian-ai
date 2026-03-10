import React, {useState, useEffect} from "react"
import { useAppDispatch, useAppSelector } from "../../../../../features/hooks";
import { QUESTIONS_ENUM } from "../../../../../utils/questionEnum";
import { changeGridCellData } from "../../../../../features/grids/gridsSlice";
import { BasicController } from "../../BasicController";
import { ARRAY_2D_GET_TWO_DIRECTIONS_FROM_CELL } from "../gridUtils";
import { pushJSXToLog } from "../../../../../features/problemInfo/problemSlice";
import { collectSumOfPreviousCells, setPrevEvaluatedCells, UniquePathsInitialCellSetup } from "./uniquePathsHelpers";
import { WithBasicGridClient } from "../WithBasicGridClient";
import { iterateToNextCell } from "../gridControllerUtils";
import { WithBasicGridClientInjectedProps } from "../../clientHOCProps";

const TEMPLATE_UniquePathsOneController = ({
  animationOn, play, pause, animationSpeed,
  setComplete, complete, problemNumber, setup,
}: WithBasicGridClientInjectedProps) => {
  /* Global State Variables */
  const dispatch = useAppDispatch();
  const grid = useAppSelector(state => state.grids[0] ? state.grids[0].cells : []);
  /* Local State Variables */
  const [currentCell, setCurrentCell] = useState<[number, number]>([0, 0]);

  const clickSetUp = async () => {
    setup();
    setCurrentCell([0, 0])
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
    
    let prevCells = ARRAY_2D_GET_TWO_DIRECTIONS_FROM_CELL(currentCell, "BEHIND", grid);
    const sum = collectSumOfPreviousCells(dispatch, prevCells, grid);
    dispatch(changeGridCellData({
      gridIndex: 0,
      row: currentCell[0],
      col: currentCell[1],
      data: sum,
    }))
    //set current cell to next cell in the grid
    const [nextRow, nextCol] = iterateToNextCell(dispatch, grid, currentCell, true);
    if (nextRow === 0 && nextCol === 0) {
      setComplete(true);
      pause();
      const element: JSX.Element = (
        <p>{`Last element reached. Final number of paths is `}<b>{`${sum}`}</b></p>
      )
      dispatch(pushJSXToLog({element: element}));
      return;
    }

    setPrevEvaluatedCells(dispatch, [nextRow, nextCol], grid);
    setCurrentCell([nextRow, nextCol]);
  }

  useEffect(() => {
    if (animationOn && problemNumber === QUESTIONS_ENUM.UNIQUE_PATHS) {
      setTimeout(() => clickStep(), animationSpeed);
    }
  }, [currentCell, animationOn]);


  return (
    <div>
      <BasicController problemNumber={problemNumber} play={() => {
          if (problemNumber !== QUESTIONS_ENUM.UNIQUE_PATHS) {
              clickSetUp();
          }
          play();
        }} 
        label={"Unique Paths I"} setup={clickSetUp} step={clickStep} pause={pause} 
      />
    </div>
  )
}

export const UniquePathsOneController = 
  WithBasicGridClient(TEMPLATE_UniquePathsOneController, "Unique Paths I Grid")