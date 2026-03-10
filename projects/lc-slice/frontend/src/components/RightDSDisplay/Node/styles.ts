import styled from "styled-components"

import {CellStatus} from "../../../utils/types"


type NodeContainerProps = {
    styleWidth: number,
    status: CellStatus
}


const statusToColor = (status: CellStatus) => {
    switch(status) {
        case "START": {
            console.log("yellow")
            return "rgb(0, 0, 0)"
        }
        case "END": {
            return "green"
        }
        case "EXPLORED": {
            return "green"
        }
        default: {
            return "white"
        }
    }   
}

export const NodeContainer = styled.div<NodeContainerProps>`
    width: ${props => `${props.styleWidth}px`};
    height: $50px;
    outline: 1px solid gray;
    display: inline-flex;
    justify-content: center;
    align-items: center;
    padding: 0px;
    background-color: ${props => statusToColor(props.status)}
    &:hover {
        background-color: lightblue;
    }
`