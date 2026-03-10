//#region Imports
import {createSlice, PayloadAction} from "@reduxjs/toolkit"
import {RootState, Cell, GridDS, CellStatus} from "../../utils/types"
import * as ProblemPayloads from "./problemPayloads"
//#endregion

const initialState: RootState["problem"] = {
	problemNumber: 0, 
	problemTitle: "Default Title",
	problemDescription: "Default Description",
	problemLog: [],
}    


// #region Grids Slice
const problemSlice = createSlice({
	name: "problem",
	initialState, 
	//#region Local Actions
	reducers: {
		//TODO: Possibly should have side effect, since all the problem info is associated with the number
		/**
		 * Changes the problem number
		 * @param {number} problemNumber The grid in the grid list to be operated on.
		 * @param {number} newWidth The new width (num. columns) of the grid.
		 * @param {number} [defaultValue] The value that will populate the newly created column.
		 */
		changeProblemNumber: (
			state: RootState["problem"], 
			action: PayloadAction<ProblemPayloads.ChangeProblemNumberPayload>
		) => {
			const {problemNumber} = action.payload;
			if (problemNumber <= 0) {
				return;
			}
			state.problemNumber = problemNumber;
		},
		changeProblemDescription: (
			state: RootState["problem"],
			action: PayloadAction<ProblemPayloads.ChangeProblemDescriptionPayload>
		) => {
			const {description} = action.payload;
			state.problemDescription = description;
		},
		changeProblemTitle: (
			state: RootState["problem"],
			action: PayloadAction<ProblemPayloads.ChangeProblemTitlePayload>
		) => {
			const {title} = action.payload;
			state.problemTitle = title;
		}, 
		clearLog: (
			state: RootState["problem"],
		) => {
			state.problemLog = [];
		},
		pushJSXToLog: (
			state: RootState["problem"],
			action: PayloadAction<ProblemPayloads.PushJSXPayload>
		) => {
			state.problemLog.push(action.payload.element);
		},
		popJSXToLog: (
			state: RootState["problem"],
		) => {
			state.problemLog.pop();
		}
	},

}); 
//#endregion

//#region Default Exports
export const problemReducer = problemSlice.reducer 

export const {
	changeProblemNumber,
	changeProblemDescription,
	changeProblemTitle,
	clearLog,
	pushJSXToLog,
	popJSXToLog
} = problemSlice.actions

export const selectProblem = (state: RootState) => state.problem
export const selectProblemNumber = (state: RootState) => state.problem.problemNumber;
export const selectProblemDescription = (state: RootState) => state.problem.problemDescription;

