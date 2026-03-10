import { Cell } from "./types"

export const defaultGridCell: Cell = {
    data: 0,
    status: "UNEXPLORED"
}

export const defaultGrid: Cell[][] = [
    [defaultGridCell, defaultGridCell, defaultGridCell, defaultGridCell, defaultGridCell],
    [defaultGridCell, defaultGridCell, defaultGridCell, defaultGridCell, defaultGridCell],
    [defaultGridCell, defaultGridCell, defaultGridCell, defaultGridCell, defaultGridCell],
    [defaultGridCell, defaultGridCell, defaultGridCell, defaultGridCell, defaultGridCell],
    [defaultGridCell, defaultGridCell, defaultGridCell, defaultGridCell, defaultGridCell]
]

export const defaultArray: Cell[] = [
    {data: 0, status: "NO_DATA"}, 
    {data: 1, status: "NO_DATA"},
    {data: 2, status: "NO_DATA"},
    {data: 3, status: "NO_DATA"},
    {data: 4, status: "NO_DATA"},
    {data: 5, status: "NO_DATA"},
]

const defaultData = {
    defaultGridCell,
    defaultGrid,
    defaultArray
}

export default defaultData

/*6
    function dijkstra
        (if startNode and finished Node exist and do not overlap)
            return
        startNode.distance = 0;
        all other nodes have distance of infinity
        
        while (unvisitedNodes)
            sortEachNodeByDistance //this is wildely inefficient
            get closestNode
            set it to visited
            if closetsetnode === finish return true

            update all neighboring node to have current distance + 1
            so first node and neighbors look like


            1
            ^ 
            |
     1  <-- 0 --> 1
            |
            v
            1

        return nodes in the order they were visited

*/