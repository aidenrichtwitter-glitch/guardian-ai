import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState, GraphDS, GraphNode} from "../../utils/types";
import { AddNodePL } from "./graphPayloads";
import { createGraphActionS, createGraphActionSA, GraphBeforeEachFunc } from "./graphUtils";
import { isValidIndex, isStateValid } from "../featureUtils";
import { addGraph, AddGraphPL, deleteAllStructs, deleteGraph, DeleteGraphPL} from "../sharedActions";
import * as GraphPLs from "./graphPayloads"
import hash from "object-hash"


const checkGraphExists: GraphBeforeEachFunc = (
    state: RootState["graphs"], 
    action?: PayloadAction<GraphPLs.GraphIndexPL>
) => {
	return action ? ( isValidIndex(state.length, action.payload.graphIndex) ) : (isStateValid(state.length));
}


const initialState: RootState["graphs"] = [];

const graphsSlice = createSlice({
    name: "graphs",
    initialState,
    reducers: {
        changeNodeRadius: (
            state: RootState["graphs"],
            action: PayloadAction<GraphPLs.ChangeNodeRadiusPL>
        ) => {
            const {graphIndex, newRadius} = action.payload;
            if (graphIndex < 0 || graphIndex >= state.length) {
                return;
            }
            state[graphIndex].nodeRadius = newRadius;
        },

        switchConnected: (
            state: RootState["graphs"],
            action: PayloadAction<GraphPLs.GraphIndexPL>
        ) => {
            const {graphIndex} = action.payload;
            if (graphIndex < 0 || graphIndex >= state.length) {
                return;
            }
            state[graphIndex].connected = !state[graphIndex].connected
        },
        addNode: createGraphActionSA(
            [checkGraphExists], 
            (state: RootState["graphs"], action: PayloadAction<GraphPLs.AddNodePL>) => {
                const {graphIndex, data, name, links, initX, initY} = action.payload
                const numNodes = state[graphIndex].nodes.length;
                state[graphIndex].nodes.push({
                    data: data !== undefined ? data : 0,
                    name: name ? name : `GRAPH_${graphIndex + 1}_NODE_${numNodes + 1}`,
                    links: links ? links : [],
                    initX: initX ? initX : 200,
                    initY: initY ? initY : 200,
                })
            }
        ),
    },
    extraReducers: (builder) => {
        builder.addCase(addGraph, (
            state: RootState["graphs"],
            action: PayloadAction<AddGraphPL>
        ) => {
            const {nodeRadius,connected,weighted,directed,edgeLabels,label} = action.payload;
            state.push({
                nodeRadius: nodeRadius ? nodeRadius : 20,
                connected: connected ? connected : false,
                weighted: weighted ? weighted : false,
                directed: directed ? directed: false,
                edgeLabels: edgeLabels ? edgeLabels : [],
                label: label ? label : `GRID_${state.length + 1}`,
                nodes: [],
            })
        }).addCase(deleteGraph, (
            state: RootState["graphs"],
            action: PayloadAction<DeleteGraphPL>
        ) => {
            const numDelete = action.payload.num ? action.payload.num : 1;
            if (numDelete < 0) {
                return;
            }
            if (numDelete >= state.length) {
                return [];
            }
            for (let i = 0; i < numDelete; i++) {
                state.pop();
            }
        }).addCase(deleteAllStructs, (
            state: RootState["graphs"]
        ) => {
            return [];
        })
    }
})

export const graphsReducer = graphsSlice.reducer;
export const {
    changeNodeRadius,
    switchConnected,
    addNode
} = graphsSlice.actions

export const selectAllGraphs = (state: RootState) => state.graphs;