import React from "react";
import { CellStatus } from "../../../utils/types";
import "./node.scss"


type ArrayNodeProps = {
    rowIdx: number,
    colIdx: number,
    styleWidth: number,
    data: number,
    status: CellStatus
}

const onlyNumbers = (str: string) => {
    return /^[0-9.,]+$/.test(str);
}

export const ArrayNode = ({rowIdx, colIdx, styleWidth, data, status}: ArrayNodeProps) => {
    return (
        <div
            className={
                status === 'START' ? "node_start" : status === "END" ? "node_end" : "node"
            } 
            contentEditable='true'
        >
            {data}
        </div>
    )
}
