import { RootState } from "../../utils/types";
import { PayloadAction } from "@reduxjs/toolkit";
import {Cell} from "../../utils/types"

export type GraphBeforeEachFunc = (state: RootState["graphs"], action?: PayloadAction<any>) => boolean;
export type GraphDuringWithActionFunc = (state: RootState["graphs"], action: PayloadAction<any>) => void
export type GraphDuringFunc = (state: RootState["graphs"]) => void;

/* Grid Slice Action Creators */
export const createGraphActionSA = (beforeEach: GraphBeforeEachFunc[], during: GraphDuringWithActionFunc) => {
	return (state: RootState["graphs"], action: PayloadAction<any>) => {
        for (let i = 0; i < beforeEach.length; i++) {
		    const beforeTest = beforeEach[i](state, action);
		    if (!beforeTest) {
			    return;
		    }
        }
		during(state, action);
	}
}

export const createGraphActionS = (beforeEach: GraphBeforeEachFunc, during: GraphDuringFunc) => {
	return (state: RootState["graphs"]) => {
		const beforeTest = beforeEach(state);
		if (!beforeTest) {
			return;
		}
		during(state);
	}
}