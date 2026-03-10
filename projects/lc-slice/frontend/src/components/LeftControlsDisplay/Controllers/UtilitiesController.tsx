import React from "react"
import { useSelector} from "react-redux"
import { 
    changeGridWidth, 
    changeGridHeight, 
    clearGridCells, 
    clearGridRow,
    changeGridCellSize
} from "../../../features/grids/gridsSlice";
import { selectAllGrids } from "../../../features/grids/gridsSlice";
import { useAppDispatch, useAppSelector } from "../../../features/hooks";
import {addArray, addGrid, deleteArray, deleteGrid, addGraph} from "../../../features/sharedActions"
import {RootState} from "../../../utils/types"
import { ControllerButtons } from "./BasicController";
import "./controller.css"

type UtilitiesControllerType = {
    inputGrid: number,
    selectedRow: number,
    clearValue: number
}


//TODO: Make inputGrid, selectedRow, and clearValue native to the Utilities Controller
export const UtilitiesController = ({inputGrid, selectedRow, clearValue}: UtilitiesControllerType) => {
    const grids = useSelector(selectAllGrids);
    const arraysLength = useAppSelector(state => state.arrays.length);
    const dispatch = useAppDispatch();

    const clickAddGraph = () => {
        dispatch(addGraph({}));
    }

    const clickIncreaseRows = () => {
        dispatch(changeGridWidth({gridIndex: inputGrid, newWidth: grids[inputGrid].width + 1}))
    }

    const clickDecreaseRows = () => {
        if (grids[inputGrid].width - 1 >= 2) {
            dispatch(changeGridWidth({
                gridIndex: inputGrid, 
                newWidth: grids[inputGrid].width - 1
            }))
        }
    }

    const clickIncreaseColumns = () => {
        if (grids.length === 0) {
            return;
        }
        dispatch(changeGridHeight({
            gridIndex: inputGrid, 
            newHeight: grids[inputGrid].height + 1
        }))
    }

    const clickDecreaseColumns = () => {
        if (grids.length === 0) {
            return;
        }
        if (grids[inputGrid].height - 1 >= 2) {
            dispatch(changeGridHeight({gridIndex: inputGrid, newHeight: grids[inputGrid].height - 1}))
        }  
    }

    const clickAddGrid = () => {
        dispatch(addGrid({num: 1}));
    }

    const clickDeleteGrid = () => {
        dispatch(deleteGrid({num: 1, gridsLength: grids.length}))
    }

    const clickClearSelectedGrid = () => {
        if (grids.length === 0) {
            return;
        }
        dispatch(clearGridCells({gridIndex: inputGrid, defaultValue: 0}));
    }

    const clickClearSelectedRow = () => {
        if (grids.length === 0) {
            return;
        }
        dispatch(clearGridRow({
            gridIndex: inputGrid,
            row: selectedRow,
            data: clearValue,
            status: "UNEXPLORED"
        }))
    }

    const clickAddArray = () => {
        dispatch(addArray({num: 1}));
    }

    const clickDeleteArray = () => {
        dispatch(deleteArray({num: 1, arraysLength: arraysLength}));
    }

    return (
        <div>
            <ControllerButtons 
                buttonActions={[clickAddGraph]} 
                buttonLabels={["Add Graph"]} 
                //label="Graph Utils"
            />
            <ControllerButtons 
                buttonActions={[clickDecreaseRows, clickIncreaseRows, clickDecreaseColumns, clickIncreaseColumns]}
                buttonLabels={["Decrease Rows", "Increase Rows", "Decrease Columns", "Increase Columns"]}
                //label={"Grid Utils"}
            />
            <ControllerButtons
                buttonActions={[clickClearSelectedGrid, clickClearSelectedRow]}
                buttonLabels={["Clear Selected Grid", "Clear Selected Row"]}
                //label={"Clear Grid Utils"}
            />
            <ControllerButtons
                buttonActions={[clickAddGrid, clickDeleteGrid, clickAddArray, clickDeleteArray]}
                buttonLabels={["Add Grid", "Delete Grid", "Add Array", "Delete Array"]}
                //label={"Add/Delete Grid/Array"}
            />
            <div className={"controller_buttons_container"}>
                <button 
                    className={"controller_button"} 
                    onClick={() => dispatch(changeGridCellSize({gridIndex: 0, width: 100, height: 100}))}
                >
                    Change Grid Cell Size
                </button>
            </div>
        </div>
    );
}