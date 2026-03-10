import { RootState } from "../../utils/types";
import { PayloadAction } from "@reduxjs/toolkit";

/* Grid Slice Type Helpers */
export type GridBeforeEachFunc = (state: RootState["grids"], action?: PayloadAction<any>) => boolean;
export type GridDuringWithActionFunc<ActionPayload> = (state: RootState["grids"], action: PayloadAction<ActionPayload>) => void
export type GridDuringFunc = (state: RootState["grids"]) => void;

/* Grid Slice Action Creators */
export const createGridActionSA = <ActionPayload>(beforeEach: GridBeforeEachFunc, during: GridDuringWithActionFunc<ActionPayload>) => {
	return (state: RootState["grids"], action: PayloadAction<ActionPayload>) => {
		const beforeTest = beforeEach(state, action);
		if (!beforeTest) {
			return;
		}
		during(state, action);
	}
}

export const createGridActionS = (beforeEach: GridBeforeEachFunc, during: GridDuringFunc) => {
	return (state: RootState["grids"]) => {
		const beforeTest = beforeEach(state);
		if (!beforeTest) {
			return;
		}
		during(state);
	}
}