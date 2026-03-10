import React, {useState, useEffect} from "react"
import { useAppDispatch, useAppSelector } from "../../../../../features/hooks";
import { 
    deleteGrid, 
    copyGrid, 
    deleteAllStructs 
} from "../../../../../features/sharedActions";
import { 
    changeGridCell, 
    changeGridCellStatus 
} from "../../../../../features/grids/gridsSlice";
import { 
    DEFAULT_ISLANDS_GRIDS 
} from "./IslandsGrids";
import {Cell} from "../../../../../utils/types"
import {selectProblemNumber } from "../../../../../features/problemInfo/problemSlice";
import { BasicController } from "../../BasicController";
import {
  GRID_CELL_INDEX_HAS_DATA, 
  ARRAY_2D_GET_FOUR_DIRECTIONS_FROM_CELL, 
  GRID_CELL_ADD,
  GRID_CELL_INDEX_GET_DATA,
  GRID_CELL_INDEX_HAS_STATUS,
  ARRAY_2D_GET_PREVIOUS_INDEX,
  ARRAY_2D_CONVERT_TO_CELL,
  ARRAY_2D_GET_DIRECTION_FROM_PREVIOUS_CELL,
  ARRAY_2D_GET_EIGHT_DIRECTIONS_FROM_CELL,
  ARRAY_2D_GET_NEXT_INDEX
} from "../gridUtils"
import { clearState } from "../../../../../utils/clearState";
import { WithBasicGridClientInjectedProps } from "../../clientHOCProps";
    
    
type P695_CONTEXT = [number, number][]
    
type P617_PROPS = {
    animationOn: boolean,
    play: () => void,
    pause: () => void,
    animationSpeed: number
}
    
export const Problem695Controller = ({
  animationOn, play, pause, animationSpeed,
  client, setup, problemNumber
}: WithBasicGridClientInjectedProps) => {
    /* Access the Global State */
    const dispatch = useAppDispatch();
    const grid = useAppSelector(state => state.grids[0] ? state.grids[0].cells : []);

    const clickSetup = async() => {
      setup();
    }

    //Function return values
    const [numIslands, setNumIslands] = useState<number>(0);
    const [currentCell, setCurrentCell] = useState<[number, number]>([0, 0]);
    const [stackContext, setStackContext] = useState<[number, number][]>([]);


    useEffect(() => {
        if (animationOn && problemNumber === 695) {
            setTimeout(() => clickStep695(), animationSpeed);
        }
    }, [currentCell, animationOn]);

    const dfsCellIsValid = (cell: [number, number]): boolean => {
        return GRID_CELL_INDEX_HAS_DATA(gridCells, cell[0], cell[1], 1);
    }

    const exploreAndPushStack = (
        cell: [number, number], 
        nextCell: [number, number]
    ) => {
        //Indicate that next cell is current
        dispatch(changeGridCellStatus({
            gridIndex: 0,
            row: nextCell[0],
            col: nextCell[1],
            status: "CURRENT"
        }))
        //Add the current context to the stack
        setStack([...stack, cell])
        //Set current cell to next cell
        setCurrentCell(nextCell);
    }

    const dfs = (cell: [number, number]) => {
        const [northOfCur, eastOfCur, southOfCur, westOfCur] = 
            ARRAY_2D_GET_FOUR_DIRECTIONS_FROM_CELL(cell);
        if (dfsCellIsValid(northOfCur)) {
            exploreAndPushStack(cell, northOfCur);
            return true;
        }
        if (dfsCellIsValid(eastOfCur)) {
            exploreAndPushStack(cell, eastOfCur);
            return true;
        }
        if (dfsCellIsValid(southOfCur)) {
            exploreAndPushStack(cell, southOfCur);
            return true;
        }
        if (dfsCellIsValid(westOfCur)) {
            exploreAndPushStack(cell, westOfCur);
            return true;
        }
    }

    const clickStep = () => {
        //Explore the current cell
        dispatch(changeGridCell({
            gridIndex: 0,
            row: currentCell[0],
            col: currentCell[1],
            status: "WATER",
            data: 0,
        }));

        if (stack.length) {
            if (dfs(currentCell) === true) {
                return;
            }
            let nextCell = stack[stack.length - 1];
            if (stack.length === 1) {
                nextCell = ARRAY_2D_GET_NEXT_INDEX(gridCells, nextCell[0], nextCell[1]);
            }
            dispatch(changeGridCellStatus({
                gridIndex: 0,
                row: nextCell[0],
                col: nextCell[1],
                status: "CURRENT"
            }))
            setCurrentCell(nextCell);
            setStack(stack.slice(0, stack.length - 1));
            return;
        }

        //Increment area count here.
        if (dfs(currentCell) === true) {
            console.log("New dfs started")
            return;
        }

        const nextCell = ARRAY_2D_GET_NEXT_INDEX(gridCells, currentCell[0], currentCell[1]);
        dispatch(changeGridCellStatus({
            gridIndex: 0,
            row: nextCell[0],
            col: nextCell[1],
            status: "CURRENT"
        }))
        setCurrentCell(nextCell);
    }

    return (
        <div>
            <BasicController problemNumber={problemNumber}
                label={"Parse Islands"}
                setup={clickSetup}
                step={clickS}
                pause={pause}
                play={() => {
                    if (problemNumber !== 695) {
                        setup()
                    }
                    play()
                }}
            />
            <div>

            </div>
        </div>
    );
}