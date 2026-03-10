import { 
    GRID_CELL_INDEX_GET_DATA,
    GRID_CELL_INDEX_GET_STATUS,
    GRID_CELL_INDEX_HAS_STATUS,
    GRID_CELL_INDEX_HAS_DATA,
    ARRAY_2D_CONVERT_TO_CELL
} from "../../gridUtils";

const defaultArray = [
    [0,  1,  2,  3,  4,  5 ],
    [6,  7,  8,  9,  10, 11],
    [12, 13, 14, 15, 16, 17],
    [18, 19, 20, 21, 22, 23],
    [24, 25, 26, 27, 28, 29],
];


const smol = [[1]];

describe("gridUtilsCell tests", () => {
    test("if ARRAY_2D_CONVERT_TO_CELL", () => {
        const arr = ARRAY_2D_CONVERT_TO_CELL(defaultArray);
        expect(arr).toEqual([
            [
                {data: 0, status: "UNEXPLORED"},
                {data: 1, status: "UNEXPLORED"},
                {data: 2, status: "UNEXPLORED"},
                {data: 3, status: "UNEXPLORED"},
                {data: 4, status: "UNEXPLORED"},
                {data: 5, status: "UNEXPLORED"},
            ],
            [
                {data: 6, status: "UNEXPLORED"},
                {data: 7, status: "UNEXPLORED"},
                {data: 8, status: "UNEXPLORED"},
                {data: 9, status: "UNEXPLORED"},
                {data: 10, status: "UNEXPLORED"},
                {data: 11, status: "UNEXPLORED"},
            ],
            [
                {data: 12, status: "UNEXPLORED"},
                {data: 13, status: "UNEXPLORED"},
                {data: 14, status: "UNEXPLORED"},
                {data: 15, status: "UNEXPLORED"},
                {data: 16, status: "UNEXPLORED"},
                {data: 17, status: "UNEXPLORED"},
            ],
            [
                {data: 18, status: "UNEXPLORED"},
                {data: 19, status: "UNEXPLORED"},
                {data: 20, status: "UNEXPLORED"},
                {data: 21, status: "UNEXPLORED"},
                {data: 22, status: "UNEXPLORED"},
                {data: 23, status: "UNEXPLORED"},
            ],
            [
                {data: 24, status: "UNEXPLORED"},
                {data: 25, status: "UNEXPLORED"},
                {data: 26, status: "UNEXPLORED"},
                {data: 27, status: "UNEXPLORED"},
                {data: 28, status: "UNEXPLORED"},
                {data: 29, status: "UNEXPLORED"},
            ]
        ])
        
    })


    test("if GRID_CELL_INDEX_GET_DATA works", () => {
        const arr = ARRAY_2D_CONVERT_TO_CELL(defaultArray);
        let result = GRID_CELL_INDEX_GET_DATA(arr, 0, 0);
        expect(result).toEqual(0);
        result = GRID_CELL_INDEX_GET_DATA(arr, arr.length - 1, arr[0].length - 1);
        expect(result).toEqual(29);
        result = GRID_CELL_INDEX_GET_DATA(arr, 0, 5)
        expect(result).toEqual(5);
    }) 

    test("if GRID_CELL_INDEX_GET_STATUS", () => {
        const arr = ARRAY_2D_CONVERT_TO_CELL(defaultArray);
        const str: string = GRID_CELL_INDEX_GET_STATUS(arr, 0, 0) as string
        expect(str).toEqual("UNEXPLORED");
    })
    test("if GRID_CELL_INDEX_HAS_DATA", () => {
        const arr = ARRAY_2D_CONVERT_TO_CELL(defaultArray);
        let boolCheck = GRID_CELL_INDEX_HAS_DATA(arr, 0, 0, 0);
        expect(boolCheck).toEqual(true);
        boolCheck = GRID_CELL_INDEX_HAS_DATA(arr, 0, 0, 1);
        expect(boolCheck).toEqual(false);
        boolCheck = GRID_CELL_INDEX_HAS_DATA(arr, arr.length - 1, arr[0].length - 1, 29);
        expect(boolCheck).toEqual(true);
        boolCheck = GRID_CELL_INDEX_HAS_DATA(arr, arr.length - 1, arr[0].length - 1, 5);
        expect(boolCheck).toEqual(false);

    })
    test("if GRID_CELL_INDEX_HAS_STATUS", () => {
        const arr = ARRAY_2D_CONVERT_TO_CELL(defaultArray);
        let boolCheck = GRID_CELL_INDEX_HAS_STATUS(arr, 0, 0, "UNEXPLORED");
        expect(boolCheck).toEqual(true);
        boolCheck = GRID_CELL_INDEX_HAS_STATUS(arr, 0, 0, "WATER");
        expect(boolCheck).toEqual(false);
    })
})