import { GraphDS, GraphNode } from "../../utils/types"

export interface GraphIndexPL {
    graphIndex: number
}

export interface ChangeNodeRadiusPL extends GraphIndexPL {
    newRadius: number
}

export type AddNodePL = Partial<GraphNode> & GraphIndexPL
