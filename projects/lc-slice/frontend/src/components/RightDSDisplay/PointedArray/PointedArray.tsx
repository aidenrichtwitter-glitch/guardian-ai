import React from "react"
import { useAppSelector } from "../../../features/hooks"
import { Cell } from "../../../utils/types"
import {ArrayNode} from "../Node"



type PointedArrayProps = {
    arrayIndex: number
}

export const PointedArray = ({arrayIndex}: PointedArrayProps) => {

    const array = useAppSelector(state => state.arrays[arrayIndex]);

    return (
        <div style={{
            marginBottom: "20px", 
            width: `${array.data.length * 50}px`,}}>
            {array.pointerLocations.map((pointer, idx) => (
                <div style={{
                    width: "20px", 
                    height: "15px", 
                    marginBottom: "10px",
                    marginLeft: "10px",
                    position: "relative",
                    left: `${100 / array.data.length * pointer}%`
                }}
                    key={`Array_Pointer_${idx}`}
                >
                    {`p${idx + 1}`}
                </div>
            ))}
            {array.data.map((cell, idx) => (
                <ArrayNode 
                    status={cell.status}
                    data={cell.data}
                    key={`Array_Cell_${idx}`}
                    rowIdx={0}
                    colIdx={idx}
                    styleWidth={50}
                />
            ))}  
        </div>
    )
}