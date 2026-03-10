import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {CellStatus, LinkedListDS, RootState} from "../../utils/types"
import { copyLinkedList, CopyLinkedListPayload, deleteAllStructs } from "../sharedActions";
import { basicNodeAlterPL, pushListNodePL } from "./linkedListPayloads";


const initialState: RootState["linkedLists"] = [];

const linkedListsSlice = createSlice({
    name: "linkedLists",
    initialState,
    reducers: {
      pushListNode: (state: RootState["linkedLists"], action: PayloadAction<pushListNodePL>) => {
        const {data} = action.payload;
        state[0].listData.push(data);
      },
      disconnectNode: (state: RootState["linkedLists"], action: PayloadAction<basicNodeAlterPL>) => {
        const {nodeIdx} = action.payload
        state[0].instruction.operateOnNode = nodeIdx;
        state[0].instruction.performOperation = "DISCONNECT_NODE";
        state[0].connectRight[nodeIdx] = false;
      },
      removeNode: (state: RootState["linkedLists"], action: PayloadAction<basicNodeAlterPL>) => {
        state[0].instruction.operateOnNode = action.payload.nodeIdx;
        state[0].instruction.performOperation = "REMOVE_NODE";
      }
    },
    extraReducers: (builder) => {
      builder.addCase(copyLinkedList, (
        state: RootState["linkedLists"], 
        action: PayloadAction<CopyLinkedListPayload>
      ) => {
        const {listData, linkStatus} = action.payload;
        const newLinkedList: LinkedListDS = {
          listData: listData,
          linkStatus: linkStatus,
          label: "Linked List #1",
          connectRight: [...listData.map(data => true).slice(0, listData.length - 1), false],
          instruction: {
            operateOnNode: -1,
            performOperation: "DO_NOTHING"
          },
          nodeStatusData: listData.map(ele => "NO_STATUS")
        }
        state.push(newLinkedList);
      }).addCase(deleteAllStructs, (
        state: RootState["linkedLists"]
      ) => {
        return [];
      })
    }
})

export const linkedListReducer = linkedListsSlice.reducer

export const {
  pushListNode,
  disconnectNode,
  removeNode
} = linkedListsSlice.actions

export const selectAllLinkedLists = (state: RootState) => state.linkedLists;