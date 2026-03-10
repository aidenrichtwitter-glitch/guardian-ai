import { RootState } from "../../utils/types";
import { Action, PayloadAction } from "@reduxjs/toolkit";
import {Cell} from "../../utils/types"

export type ArrayBeforeEachFunc = (state: RootState["arrays"], action?: PayloadAction<any>) => boolean;
export type ArrayDuringWithActionFunc<ActionPayload> = (state: RootState["arrays"], action: PayloadAction<ActionPayload>) => void
export type ArrayDuringFunc = (state: RootState["arrays"]) => void;

/* Grid Slice Action Creators */
export const createArrayActionSA = <ActionPayload>(beforeEach: ArrayBeforeEachFunc[], during: ArrayDuringWithActionFunc<ActionPayload>) => {
	return (state: RootState["arrays"], action: PayloadAction<ActionPayload>) => {
        for (let i = 0; i < beforeEach.length; i++) {
		    const beforeTest = beforeEach[i](state, action);
		    if (!beforeTest) {
			    return;
		    }
        }
		during(state, action);
	}
}

export const createArrayActionS = (beforeEach: ArrayBeforeEachFunc, during: ArrayDuringFunc) => {
	return (state: RootState["arrays"]) => {
		const beforeTest = beforeEach(state);
		if (!beforeTest) {
			return;
		}
		during(state);
	}
}

export const indexExistsOnArray = (arr: Cell[], index: number): boolean => {
    return (arr.length !== 0 && index >= 0 && index < arr.length);
}