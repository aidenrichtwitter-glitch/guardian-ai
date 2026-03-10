//#region Imports
import {createSlice} from "@reduxjs/toolkit"
import {RootState, Cell, GridDS, CellStatus} from "../../utils/types"
import { PayloadAction } from "@reduxjs/toolkit"
import * as GridPayloads from "./gridPayloads"

import {
	addGrid,
	AddGridPayload,
	deleteGrid,
	DeleteGridPayload,
	deleteGridAt,
	DeleteGridAtPayload,
	copyGrid,
	CopyGridPayload,
	addDataStructure,
	AddDataStructurePayload,
	deleteAllStructs,
  addArray
} from "../sharedActions"

import {
	GridBeforeEachFunc,
	createGridActionSA,
  createGridActionS
} from "./gridSliceUtils"

import { isValidIndex, isStateValid } from "../featureUtils"

import { ThunkAction} from "@reduxjs/toolkit";
import { Action } from "@reduxjs/toolkit";
import {defaultGrid} from "../../utils/defaultData";
import { pushData, shift } from "../arrays/arraysSlice"

//#endregion

//Default Cell value

const initialState: RootState["grids"] = [];

const gridBeforeEach: GridBeforeEachFunc = (state: RootState["grids"], action?: PayloadAction<GridPayloads.GridIndexPL>) => {
	return action ? ( isValidIndex(state.length, action.payload.gridIndex) ) : (isStateValid(state.length))
}

// #region Grids Slice
const gridsSlice = createSlice({
	name: "grids",
	initialState, 
	//#region Local Actions
	reducers: {
    switchEditable: createGridActionSA<GridPayloads.GridIndexPL>(
      gridBeforeEach, (state, action) => {
        const {gridIndex} = action.payload;
        state[gridIndex].editable = !state[gridIndex].editable;
      }
    ),
		/**
		 * Changes the width of the grid, adding a new column to each row.
		 * @param {number} gridIndex The grid in the grid list to be operated on.
		 * @param {number} newWidth The new width (num. columns) of the grid.
		 * @param {number} [defaultValue] The value that will populate the newly created column.
		 */
		changeGridWidth: createGridActionSA(gridBeforeEach, (
			state,
			action: PayloadAction<GridPayloads.ChangeGridWidthPayload>
		) => {
			const {newWidth, defaultValue, gridIndex} = action.payload;
			if (newWidth < 2) {
				return;
			}
			if (newWidth > state[gridIndex].width) {
				//Iterate through each row of the grid
				for (let i = 0; i < state[gridIndex].height; i++) {
					//Iterate through each newly added column
					for (let newCols = 0; newCols < newWidth - state[gridIndex].width; newCols++) {
						state[gridIndex].cells[i].push({
							data: defaultValue ? defaultValue : 0,
							status: "UNEXPLORED",
						});
					}
				}
	
			} else if (newWidth < state[gridIndex].width) {
				//For each row
				for (let i = 0; i < state[gridIndex].height; i++) {
					//for each destroyed column
					for (let destroyedCols = 0; destroyedCols < state[gridIndex].width - newWidth; destroyedCols++) {
						state[gridIndex].cells[i].pop();
					}
				}
			}
			state[gridIndex].width = newWidth;	
		}),
		/**
		 * Changes the height of the grid, adding new rows below the last existing row.low.
		 */
		changeGridHeight: createGridActionSA(gridBeforeEach, (
			state, 
			action: PayloadAction<GridPayloads.ChangeGridHeightPayload>
		) => {
			const {newHeight, defaultValue, defaultStatus, gridIndex} = action.payload;
			if (!isValidIndex(state.length, gridIndex) || newHeight < 2) {
				return;
			}
			const dummyCell: Cell = {
				data: defaultValue ? defaultValue : 0,
				status: defaultStatus ? defaultStatus : "UNEXPLORED"
			}
	
			if (newHeight > state[gridIndex].height) {
				for (let i = 0; i < newHeight - state[gridIndex].height; i++) {
					let newArr = new Array(state[gridIndex].width).fill(dummyCell);
					state[gridIndex].cells.push(newArr);
				}       
			} else if (newHeight < state[gridIndex].height) {
				for (let i = 0; i < state[gridIndex].height - newHeight; i++) {
					state[gridIndex].cells.pop()
				}
			}
			state[gridIndex].height = newHeight;
		}),
		/**
		 * Replace the data in each cell with default data and status values.
		 * @param {number} gridIndex 
		 *  The grid in the grid list to be operated on.
		 * @param {number} [defaultValue] 
		 *  Value that will replace existing values in each cell.
		 * @param {CellStatus} [defaultStatus] 
		 *  Cell Status that will replace existing cell status in each cell.
		 */
		clearGridCells: (
			state: RootState["grids"], 
			action: PayloadAction<GridPayloads.ClearGridCellsPayload>
		) => {
			const {gridIndex, defaultValue, defaultStatus} = action.payload;
			if (!isValidIndex(state.length, gridIndex)) {
				return;
			}
			for (let i = 0; i < state[gridIndex].cells.length; i++) {
				for (let j = 0; j < state[gridIndex].cells[0].length; j++) {
					state[gridIndex].cells[i][j] = {
						data: defaultValue ? defaultValue : 0,
						status: defaultStatus ? defaultStatus: "UNEXPLORED"
					}
				}
			}
		},
		/**
		 * Replace the status in each cell with a new status value.
		 * @param {number} gridIndex 
		 *  The grid in the grid list to be operated on.
		 * @param {CellStatus} defaultStatus
		 *  Cell Status that will replace existing cell status in each cell.
		 */
		clearGridCellsStatus: createGridActionSA(
			gridBeforeEach, 
			(state: RootState["grids"], action: PayloadAction<GridPayloads.ClearGridCellsStatusPayload>) => {
				const {gridIndex, defaultStatus} = action.payload;
				for (let i = 0; i < state[gridIndex].cells.length; i++) {
					for (let j = 0; j < state[gridIndex].cells[0].length; j++) {
						state[gridIndex].cells[i][j].status = defaultStatus;
					}
				}
			}
		),
    changeGridCellsStatusBasedOnData: createGridActionSA<GridPayloads.ChangeGridCellsStatusBasedOnDataPayload>(
      gridBeforeEach,
      (state, action) => {
        const {gridIndex, dataToStatus} = action.payload;
        for (let i = 0; i < state[gridIndex].cells.length; i++) {
          for (let j = 0; j < state[gridIndex].cells.length; j++) {
            const {data, status} = state[gridIndex].cells[i][j];
            let newStatus = dataToStatus.get(data)
            state[gridIndex].cells[i][j].status = newStatus !== undefined ? newStatus : status;
          }
        }
      }
    ),

		/**
		 * Replace the data in each cell with default data and status values.
		 * @param {number} gridIndex 
		 *  The grid in the grid list to be operated on.
		 * @param {number} [row] 
		 *  Row in the grid to operate on.
		 * @param {number} [col] 
		 *  Column in the grid to operate on.
		 * @param {data} [data]
		 *  Data to put in the selected cell.
		 * @param {status} [status]
		 *  Status to apply to the selected cell.
		 */
		changeGridCell: (state: RootState["grids"], action: PayloadAction<GridPayloads.ChangeGridCellPayload>) => {
			const {gridIndex, row, col, data, status} = action.payload;
			if (!isValidIndex(state.length, gridIndex)|| row >= state[gridIndex].height || 
				col >= state[gridIndex].width || row < 0 || col < 0 ||
				data === null || data === undefined
			) {
				return;
			}
			state[gridIndex].cells[row][col] = {data: data, status: status}
		},
		clearGridRow: (state: RootState["grids"], action: PayloadAction<GridPayloads.ClearGridRowPayload>) => {
			const {gridIndex, row, data, status} = action.payload;
			if (!isValidIndex(state.length, gridIndex)) {
				return;
			}
			for (let i = 0; i < state[gridIndex].cells[0].length; i++) {
				state[gridIndex].cells[row][i] = {
					data: data,
					status: status,
				}
			}
		},
		/**
		 * Replace the data in each cell with default data and status values.
		 * @param {number} gridIndex 
		 *  The grid in the grid list to be operated on.
		 * @param {number} [row] 
		 *  Row in the grid to operate on.
		 * @param {number} [col] 
		 *  Column in the grid to operate on.
		 * @param {status} [status]
		 *  Status to apply to the selected cell.
		 */
		changeGridCellStatus: (state: RootState["grids"], action: PayloadAction<GridPayloads.ChangeGridCellStatusPayload>) => {
			const {gridIndex, row, col, status} = action.payload;
			if (!isValidIndex(state.length, gridIndex) || row >= state[gridIndex].height || col >= state[gridIndex].width || row < 0 || col < 0) {
				return;
			}
			state[gridIndex].cells[row][col].status = status;
		},
		changeGridCellData: (state: RootState["grids"], action: PayloadAction<GridPayloads.ChangeGridCellDataPayload>) => {
			const {gridIndex, data, row, col} = action.payload;
			if (!isValidIndex(state.length, gridIndex) || row >= state[gridIndex].height || col >= state[gridIndex].width || row < 0 || col < 0) {
				return;
			}
			state[gridIndex].cells[row][col].data = data;
		},
		/**
		 * Replace the data in each cell with default data and status values.
		 * @param {number} gridIndex
		 *  The grid in the grid list to be operated on.
		 * @param {string} label 
		 *  New label for the selected grid data structure.
		 */
		changeGridLabel: (state: RootState["grids"], action: PayloadAction<GridPayloads.ChangeGridLabelPayload>) => {
			const {gridIndex, label} = action.payload;
			if (!isValidIndex(state.length, gridIndex) || gridIndex >= state.length || gridIndex < 0) {
				return;
			}
			state[gridIndex].label = label;
		},
		/**
		 * Change the css size of a cell.
		 * @param {number} gridIndex
		 * The grid in the grid list to operate on.
		 * @param {number} width
		 *  The new style width of the cell.
		 * @param {number} height 
		 *  The new style height of the cell.
		 */
		changeGridCellSize: (state: RootState["grids"], action: PayloadAction<GridPayloads.ChangeGridCellSizePayload>) => {
			const {width, height, gridIndex} = action.payload;
			if (!isValidIndex(state.length, gridIndex)) {
				return;
			}
			state[gridIndex].cellStyleWidth = width;
			state[gridIndex].cellStyleHeight = height;
		},
		changeGridIndividualCellSize: createGridActionSA(gridBeforeEach, (
			state: RootState["grids"],
			action: PayloadAction<GridPayloads.ChangeGridIndividualCellSizePayload>
		) => {
			const {gridIndex, row, col, width, height} = action.payload;
			state[gridIndex].cells[row][col].width = width;
			state[gridIndex].cells[row][col].height = height;
		})
	},
	//#endregion
	//#region Shared Actions
	extraReducers: (builder) => {
		builder.addCase(addGrid, (
		   state: RootState["grids"],
		   action: PayloadAction<AddGridPayload>
	   ) => {
		   const {num} = action.payload;
		   let prevLength = state.length;
		   for (let i = 0; i < num; i++) {
			   prevLength += 1;
			   const newGrid: GridDS = {
				   type: "GRID",
				   indexInList: (prevLength - 1) + i,
				   label: `Grid #${prevLength + i}`,
				   cells: defaultGrid,
				   cellStyleHeight: 60,
				   cellStyleWidth: 60,
				   width: defaultGrid[0].length,
				   height: defaultGrid.length,
           editable: false,
			   };
			   state.push(newGrid);
		   }
	   }).addCase(deleteGrid, (
		   state: RootState["grids"], 
		   action: PayloadAction<DeleteGridPayload>
	   ) => {
		   const {num} = action.payload;
		   if (num <= 0) {
			   return state;
		   }
		   if (num > state.length) {
				return [];
		   }
		   for (let i = 0; i < num; i++) {
				state.pop();
		   }
	   }).addCase(deleteGridAt, (
		   state: RootState["grids"], 
		   action: PayloadAction<DeleteGridAtPayload>
	   ) => {
			const {idx} = action.payload;
		   	if (idx >= state.length || idx < (state.length * - 1)) {
				return;
		   	}
		   	const effectiveIndex = idx >= 0 ? idx : state.length - (idx * -1);
		   	if (effectiveIndex === state.length - 1) {
				state = [...state.slice(0, state.length - 1)]
			   	return;
		   	} else {
				state[effectiveIndex + 1].indexInList -= 1;
			   	state = [...state.slice(0, effectiveIndex), ...state.slice(effectiveIndex + 1)];
			   	return;    
		   	}
	   }).addCase(copyGrid, (
			state: RootState["grids"],
			action: PayloadAction<CopyGridPayload>
	   ) => {
			const {cells} = action.payload;
			let prevLength = state.length;
			const newGrid: GridDS = {
				type: "GRID",
				indexInList: (prevLength),
				label: `Grid #${prevLength + 1}`,
				cells: cells,
				cellStyleHeight: 60,
				cellStyleWidth: 60,
				width: cells[0].length,
				height: cells.length,
        editable: false,
			};
			state.push(newGrid);
	  }).addCase(addDataStructure, (
			state: RootState["grids"],
			action: PayloadAction<AddDataStructurePayload>
		) => {
			const {type, num} = action.payload;
			if (type !== "GRID") {
				return;
			}
			let prevLength = state.length;
		   	for (let i = 0; i < (num ? num : 1); i++) {
			   	prevLength += 1;
			   	const newGrid: GridDS = {
				   	type: "GRID",
				   	indexInList: (prevLength - 1) + i,
				   	label: `Grid #${prevLength + i}`,
				   	cells: defaultGrid,
				   	cellStyleHeight: 60,
				   	cellStyleWidth: 60,
				   	width: defaultGrid[0].length,
				   	height: defaultGrid.length,
            editable: false,
			   	};
			   	state.push(newGrid);
		   	}
		}).addCase(deleteAllStructs, (
			state: RootState["grids"]
		) => {
			return [];
		})
	}
	//#endregion
}) 
//#endregion

//#region Default Exports
export const gridsReducer = gridsSlice.reducer 

export const {
	changeGridCell,
	changeGridCellSize,
	changeGridHeight,
	changeGridLabel,
	changeGridWidth,
	clearGridCells,
	changeGridCellStatus,
	changeGridCellData,
	clearGridRow,
	clearGridCellsStatus,
	changeGridIndividualCellSize,
  changeGridCellsStatusBasedOnData,
  switchEditable
} = gridsSlice.actions

export const selectAllGrids = (
	state: RootState
) => state.grids;

//#endregion

//#region Thunk Action Utilities
type AppThunk = ThunkAction<void, any, unknown, Action<string>>

export const changeGridLabels = (startIndex: number, labels: string[]): AppThunk => {
	return (
		dispatch,
		getState
	) => {
		let grids = getState().grids;
		if (startIndex < 0 || startIndex >= grids.length) {
			return;
		}
		let labelBoundary = 0;
		if (startIndex + labels.length >= grids.length) {
			labelBoundary = startIndex + labels.length;
		} else {
			labelBoundary = grids.length;
		}
		let labelIndex = 0;
		for (let i = startIndex; i < labelBoundary; i++) {
			dispatch(changeGridLabel({gridIndex: i, label: labels[labelIndex]}));
			labelIndex++;
		}
	}
}

export const copyGrids = (grids: Cell[][][]): AppThunk => {
	return (
		dispatch, 
		getState
	) => {
		for (let i = 0; i < grids.length; i++) {
			dispatch(copyGrid({cells: grids[i]}));
		}
	}
}

export const changeMultiGridSameCellStatus = (
	gridIndices: number[], 
	row: number, 
	col: number, 
	status: CellStatus
): AppThunk => {
	return (
		dispatch,
		getState
	) => {
		let grids = getState().grids;
		for (let i = 0; i < gridIndices.length; i++) {
			if (gridIndices[i] < 0 || gridIndices[i] >= grids.length) {
				continue;
			}
			dispatch(changeGridCellStatus({
				gridIndex: gridIndices[i],
				row: row,
				col: col,
				status: status
			}));	
		}
	}
}

export const floodFill = (gridIndex: number): AppThunk => {
	return (
		dispatch, 
		getState
	) => {
		const dfs = (row: number, col: number, oldColor: number, newColor: number) => {
			let grid = getState().grids[gridIndex]
			if (row < 0 || col < 0 || row >= grid.height || col >= grid.width || grid.cells[row][col].data !== oldColor) {
				return;
			}
			dispatch(changeGridCell({gridIndex: gridIndex, row: row, col: col, data: newColor, status: "EXPLORED"}));
			dfs(row + 1, col, oldColor, newColor);
			dfs(row - 1, col, oldColor, newColor);
			dfs(row, col + 1, oldColor, newColor);
			dfs(row, col - 1, oldColor, newColor);
		}
		dfs(0, 0, 1, 2);
	}
}

export const floodFillFromInput = (
  gridIndex: number,
  currentCell: [number, number],
  oldValue: number, 
  newValue: number,
  newStatus: CellStatus,
): AppThunk => {
  return (
    dispatch,
    getState
  ) => {
    const dfs = (row: number, col: number, oldValue: number, newValue: number) => {
      let grid = getState().grids[gridIndex];
      if (row < 0 || col < 0 || row >= grid.height || col >= grid.width || grid.cells[row][col].data !== oldValue) {
				return;
			}
			dispatch(changeGridCell({gridIndex: gridIndex, row: row, col: col, data: newValue, status: newStatus}));
			dfs(row + 1, col, oldValue, newValue);
			dfs(row - 1, col, oldValue, newValue);
			dfs(row, col + 1, oldValue, newValue);
			dfs(row, col - 1, oldValue, newValue);
    }
    dfs(currentCell[0], currentCell[1], oldValue, newValue);
  }
}

export const floodFillFromInputWithQueue = (
  gridIndex: number,
  currentCell: [number, number],
  oldValue: number, 
  newValue: number,
  newStatus: CellStatus,
): AppThunk => {
  return (
    dispatch,
    getState
  ) => {
    const dfs = (row: number, col: number, oldValue: number, newValue: number) => {
      let grid = getState().grids[gridIndex];
      if (row < 0 || col < 0 || row >= grid.height || col >= grid.width || grid.cells[row][col].data !== oldValue) {
				return;
			}
			dispatch(changeGridCell({gridIndex: gridIndex, row: row, col: col, data: newValue, status: newStatus}));
      dispatch(pushData({arrayIndex: 0, data: [
        `[${row}, ${col}]`
      ]}));
			dfs(row + 1, col, oldValue, newValue);
			dfs(row - 1, col, oldValue, newValue);
			dfs(row, col + 1, oldValue, newValue);
			dfs(row, col - 1, oldValue, newValue);
    }
    dfs(currentCell[0], currentCell[1], oldValue, newValue);
  }
}

//#endregion
