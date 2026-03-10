import {createAction} from "@reduxjs/toolkit"
import { Cell, DataStructureType } from "../utils/types"
import {GraphDS} from "../utils/types"


type XY = {
    x: number,
    y: number
}

export type AddGraphPL = Omit<Partial<GraphDS>, "nodes">

export type DeleteGraphPL = {
    num?: number
}

export type AddArrayPayload = {
    num: number
}

export type DeleteArrayPayload = {
    num: number,
    arraysLength: number,
}

export type DeleteGridPayload = {
    num: number,
    gridsLength: number,
}

export type CopyArrayPayload = {
    data: any[],
}

export type AddGridPayload = {
    num: number
}

export type DeleteGridAtPayload = {
    idx: number
}

export type DeleteArrayAtPayload = {
    idx: number
}

export type CopyGridPayload = {
    cells: Cell[][],
}

export type CopyLinkedListPayload = {
  listData: number[],
  linkStatus: "FORWARD_LINKED" | "BACK_LINKED" | "UNLINKED" | "DOUBLY_LINKED"
}

export type AddDataStructurePayload = {
    type: DataStructureType
    num?: number
}



export const addGraph = createAction<AddGraphPL>("addGraph");
/**
 * Delete graphs from the graph list.
 * @param {number} [num]
 * The number of graphs to be deleted.
 */
export const deleteGraph = createAction<DeleteGraphPL>("deleteGraph");

/**
 * Add data structure of specific type to its corresponding list
 * @param {DataStructureType} type
 * The type of data structure to add
 * @param {number} [num]
 * The number of data structures of the specified type to add.
 */
export const addDataStructure = createAction<AddDataStructurePayload>("addDataStructure");
/**
 * Add arrays to the array list
 * @param {number} num
 * The number of arrays to add.
 */
export const addArray = createAction<AddArrayPayload>("addArray");
/**
 * Delete arrays from the array list.
 * @param {number} num
 * The number of arrays to remove.
 */
export const deleteArray = createAction<DeleteArrayPayload>("deleteArray");
/**
 * Delete array at a given index in the array list
 * @param {number} idx
 * The index of the array to remove from the array list.
 */
export const deleteArrayAt = createAction<DeleteArrayAtPayload>("deleteArrayAt")
/**
 * Copy existing array
 * @param {any[]} data
 */
export const copyArray = createAction<CopyArrayPayload>("copyArray");
/**
 * Add grids to the grid list
 * @param {number} num
 * The number of grids to add.
 */
export const addGrid = createAction<AddGridPayload>("addGrid");
/**
 * 
 * Copy pre-existing grid into grid list
 * @param {Cell[][]} cells
 * Grid to copy into the grid list (represented by 2D Array of Cells)
 */
export const copyGrid = createAction<CopyGridPayload>("copyGrid");
/**
 * Remove grids from the grid list
 * @param {number} num
 * The number of grids to remove.
 */
export const deleteGrid = createAction<DeleteGridPayload>("deleteGrid");
/**
 * Delete grid at a given index in the grid list.
 * @param {number} idx
 * The index of the grid to remove from the grid list.
 */
export const deleteGridAt = createAction<DeleteGridAtPayload>("deleteGridAt");

/**
 * Delete all data structures.
 */
export const deleteAllStructs = createAction("deleteAllStructs");

export const copyLinkedList = createAction<CopyLinkedListPayload>("copyLinkedList");