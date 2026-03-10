// #region Total Structs Imports
import {createSlice, Action} from "@reduxjs/toolkit";
import {RootState} from "../../utils/types"
import { PayloadAction } from "@reduxjs/toolkit";

import { 
    AddArrayPayload, 
    addArray, 
    deleteArray,
    DeleteArrayPayload,
    AddGridPayload, 
    addGrid,
    DeleteGridPayload,
    deleteGrid,
    copyGrid,
    CopyGridPayload,
    addDataStructure,
    AddDataStructurePayload,
    deleteAllStructs,
    AddGraphPL,
    addGraph,
    deleteGraph,
    DeleteGraphPL,
    copyLinkedList
} from "../sharedActions";

//#endregion

const initialState: RootState["totalStructs"] = 0;
//#region Total Structs Slice and Side Effects
const totalStructsSlice = createSlice({
  name: "dataStructure",
  initialState, 
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(addArray, (state, action: PayloadAction<AddArrayPayload>) => {
      const {num} = action.payload;
      return state + num;
    }).addCase(deleteArray, (state, action: PayloadAction<DeleteArrayPayload>) => {
      const {num, arraysLength} = action.payload;
      if (num <= 0) {
        return state;
      }
      if (num >= arraysLength) {
        return state - arraysLength
      }
      return state - num;
    }).addCase(addGrid, (state, action: PayloadAction<AddGridPayload>) => {
      const {num} = action.payload;
      return state + num;
    }).addCase(deleteGrid, (state, action: PayloadAction<DeleteGridPayload>) => {
      const {num, gridsLength} = action.payload;
      if (num <= 0) {
        return state;
      }
      if (num >= gridsLength) {
        return state - gridsLength;
      }
      return state - num;
    }).addCase(copyGrid, (state, action: PayloadAction<CopyGridPayload>) => {
      return state + 1;
    }).addCase(addGraph, (state, action: PayloadAction<AddGraphPL>) => {
      return state + 1;
    }).addCase(deleteGraph, (state, action: PayloadAction<DeleteGraphPL>) => {
      return action.payload.num ? state - action.payload.num : state - 1;
    }).addCase(addDataStructure, (state, action: PayloadAction<AddDataStructurePayload>) => {
      return state + (action.payload.num ? action.payload.num : 1);
    }).addCase(deleteAllStructs, (state) => {
        return 0;
    }).addCase(copyLinkedList, (state) => {
      return state + 1;
    })
  }
}) 

export const totalStructsReducer = totalStructsSlice.reducer
export const selectTotalStructs = (state: RootState) => state.totalStructs;