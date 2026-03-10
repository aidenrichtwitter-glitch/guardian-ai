import React, {useState, useEffect} from "react"
import {motion} from "framer-motion"
import { changeGridIndividualCellSize } from "../../../features/grids/gridsSlice"
import { Cell } from "../../../utils/types"

type CellHighlighterProps = {
    dispatch: any,
    cell: [number, number]
}

type TextHighlighterProps = {
    onEnter: () => void,
    onLeave: () => void,
    text: string,
    color?: string
}


export const TextHighlighter = ({onEnter, onLeave, text, color}: TextHighlighterProps) => {
    return (<motion.div
            style={{display: "inline-block"}} 
            whileHover={{scale: 1.2}} 
            onMouseEnter={() => onEnter()}
            onMouseLeave={() => onLeave()}
    >
        <i style={{color: color}} onMouseEnter={onEnter} onMouseLeave={onLeave}>{text}</i>
    </motion.div>);

}

export const CellHighlighter = ({dispatch, cell}: CellHighlighterProps) => {
    
    return (
        <motion.div
            style={{display: "inline-block"}} 
            whileHover={{scale: 1.2}} 
            onMouseEnter={() => {
                dispatch(changeGridIndividualCellSize({
                    gridIndex: 0, 
                    row: cell[0],
                    col: cell[1],
                    width: 70, 
                    height: 70,
                    }))
            }}
            onMouseLeave={() => {
                dispatch(changeGridIndividualCellSize({
                    gridIndex: 0, 
                    row: cell[0],
                    col: cell[1],
                    width: undefined, 
                    height: undefined,
                }))
            }}
        >
            <i style={{marginLeft: "10px"}}>{`   [${cell[0]}, ${cell[1]}]`}</i>
        </motion.div>
    )
}