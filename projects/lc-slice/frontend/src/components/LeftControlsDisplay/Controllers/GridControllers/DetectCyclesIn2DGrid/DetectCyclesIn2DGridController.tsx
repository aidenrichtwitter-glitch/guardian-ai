//#region Imports
import React, {useState, useEffect} from "react"
import {changeGridCellStatus, changeGridCellData, copyGrids} from "../../../../../features/grids/gridsSlice"
import { useAppDispatch, useAppSelector } from "../../../../../features/hooks";
import "../../controller.css"
import {
  ARRAY_2D_GET_EIGHT_DIRECTIONS_FROM_CELL,
    ARRAY_2D_GET_FOUR_DIRECTIONS_FROM_CELL,
    ARRAY_2D_GET_LAST_INDEX,
    DirectionString,
    GRID_CELL_INDEX_HAS_DATA,
} from "../gridUtils"
import { pushJSXToLog} from "../../../../../features/problemInfo/problemSlice";
import {GridCreationLog, SearchFromToLog } from "../logUtils";
import { WithBasicGridClient } from "../WithBasicGridClient";
import { QUESTIONS_ENUM } from "../../../../../utils/questionEnum";
import { BasicController } from "../../BasicController";
import {convertNumberArrayToAlphabetGrid, iterateToNextCell } from "../gridControllerUtils";
import { WithBasicGridClientInjectedProps } from "../../clientHOCProps";
//#endregion

const TEMPLATE_DetectCyclesIn2DGridController = ({
  animationOn, play, pause, animationSpeed,
  client, setup, problemNumber
}: WithBasicGridClientInjectedProps) => {
    /* Access the Global State */
    const dispatch = useAppDispatch();
    const gridCells = useAppSelector(state => state.grids[0] ? state.grids[0].cells : []);
    /* Local State */
    const [toReplace, setToReplace] = useState<number>(0);
    const [replaceWith, setReplaceWith] = useState<number>(2);
    const [currentCell, setCurrentCell] = useState<[number, number]>([0, 0]);
    const [stack, setStack] = useState<[number, number][]>([]);
    const [isEnd, setIsEnd] = useState<boolean>(false);

    useEffect(() => {
        if (animationOn && problemNumber === QUESTIONS_ENUM.FLOOD_FILL) {
            setTimeout(() => clickStep(), animationSpeed);
        }
    }, [currentCell, animationOn])

    /* Problem Functions */
    const clickSetUp = async () => {
      setup();
    }

    useEffect(() => {
      console.log(client);
      if (client.data && client.data.problem && client.data.problem.grids && client.data.problem.grids[0]) {
        const {interpretAs, gridData} = client.data.problem.grids[0];
        //TODO: This is also bad
        const grid = convertNumberArrayToAlphabetGrid(gridData as number[][], false);
        dispatch(copyGrids([grid]));
        const element = (
          <GridCreationLog
            dispatch={dispatch}
            numStructs={1}
            labels={["Grid #1"]}
          />
        );
        iterateToNextCell(dispatch, grid, ARRAY_2D_GET_LAST_INDEX(grid));
      }
    }, [client])

    const clickStep = () => {
       
    }

    const zilch = () => {
        return;
    }

    return (
      <BasicController problemNumber={problemNumber}
        label={"Detect Cycles in 2D Grid"}
        setup={clickSetUp}
        step={clickStep}
        pause={pause}
        play={() => {
          if (problemNumber !== QUESTIONS_ENUM.DETECT_CYCLES_IN_2D_GRID) {
              clickSetUp();
          }
          play();
        }}

      />
    );     
}

export const DetectCyclesIn2DGridController = WithBasicGridClient(TEMPLATE_DetectCyclesIn2DGridController, "Detect Cycles Grid", true)

/*exInputs={{
  labels: ["Replace: ", "With: "],
  actions: [onChangeToReplace, onChangeReplaceWith]
}} */

