import React, {useEffect, useRef, useState} from "react";
import { Grid } from "../Grid";
import { PointedArray } from "../PointedArray";
import { useAppDispatch, useAppSelector } from "../../../features/hooks";
import { RootState } from "../../../utils/types";
import "./ds.css"
import {Graph} from "../Graph/Graph"
import { LinkedList } from "../LinkedList";
import { changeNodeRadius } from "../../../features/graphs/graphsSlice";


type DSDisplayProps = {
    rightWidth: number,
}

export const DataStructureDisplay = ({rightWidth}: DSDisplayProps) => {
    const dispatch = useAppDispatch();
    const gridsLength = useAppSelector((state: RootState) => state.grids.length);
    const arraysLength = useAppSelector((state: RootState) => state.arrays.length);
    const graphsLength = useAppSelector((state: RootState) => state.graphs.length);
    const listsLength = useAppSelector((state: RootState) => state.linkedLists.length)


    return (
        <div className="data_structures_container">
            {[...Array(gridsLength)].map((grid, idx) => (
                <Grid 
                    key={`Grid_Structure_${idx}`}
                    gridIndex={idx}
                />
            ))}
            {[...Array(arraysLength)].map((array, idx) => {
                console.log(array);
                return (<PointedArray 
                    arrayIndex={idx}
                    key={`Array_Structure_${idx}`}
                />);
            })}
            {[...Array(graphsLength)].map((graph, idx) => (
                <Graph graphIndex={idx} key={`Graph_Structure_${idx}`} width={rightWidth}/>
            ))}
            {[...Array(listsLength)].map((graph, idx) => (
                <LinkedList key={`Linked_List_Structure${idx}`}/>
            ))}
        </div>
    )  
}