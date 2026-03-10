import { AnyAction } from "@reduxjs/toolkit";
import { ThunkAction } from "@reduxjs/toolkit";
import { Root } from "react-dom/client";


export type CellStatus = "NO_DATA" | "PROCESSING" | "EXPLORED" | "LOCKED" | "UNEXPLORED" | "START" | "END" |
"WATER" | "ISLAND" | "DEEP_OCEAN" | "MONKEY_ISLAND" | "CURRENT" | "PREV_EVALUATE" | "BRIDGE"

export type DataStructureType = "GRID" | "ARRAY" | "BINARY_TREE" | "GRAPH"

export type Cell = {
  data: any
  status: CellStatus
  width?: number,
  height?: number,
}

interface TreeNode<TValue = unknown, TKey = unknown> {
  left?: TreeNode<TValue>
  right?: TreeNode<TValue>
  value: TValue
  key?: TKey
}

export type GridDS = {
  type: string,
  indexInList: number,
  label: string,
  cells: Cell[][],
  width: number,
  height: number,
  cellStyleWidth: number,
  cellStyleHeight: number,
  editable: boolean,
}


export type GraphNode = {
  name: string,
  data: any,
  links: number[]
  initX: number,
  initY: number,
}

export type GraphDS = {
  nodeRadius: number,
  connected: boolean,
  weighted: boolean,
  directed: boolean,
  edgeLabels: any,
  label: string, 
  nodes: GraphNode[]
}


export type ArrDS = {
  type: string,
  label?: string,
  data: Cell[]
  width: number,
  pointerLocations: number[],
}


type InstructionString = "DO_NOTHING" | "DISCONNECT_NODE" | "REMOVE_NODE"

type InstructionType = {
  operateOnNode: number,
  performOperation: InstructionString,
}

export type ListNodeStatusType = "EXITING" | "CURRENT" | "NO_STATUS"

export type LinkedListDS = {
  label?: string,
  listData: number[],
  nodeStatusData: ListNodeStatusType[],
  connectRight: boolean[],
  linkStatus: string,
  instruction: InstructionType,
}

export type ProblemInfo = {
  problemNumber: number,
  problemTitle: string,
  problemDescription: string,
  problemLog: JSX.Element[] 
}

export type RootState = {
  problem: ProblemInfo,
  grids: GridDS[],
  arrays: ArrDS[],
  graphs: GraphDS[],
  linkedLists: LinkedListDS[],
  totalStructs: number,
}


export type RootStateKeys = keyof RootState


export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  AnyAction
>

//If you want to return a promise after dispatching the thunk write
//AppThunk<Promise<SomeReturnType>>
