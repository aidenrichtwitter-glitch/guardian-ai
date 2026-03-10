import { addGraph, addGrid, deleteArray, deleteGraph, deleteGrid } from "../../sharedActions";
import {store} from "../../store"

beforeEach(async () => {
    //Get all structs
    let arrays = store.getState().arrays;
    let grids = store.getState().grids;
    //Delete all structs
    let resultOne = await store.dispatch(deleteGrid({num: grids.length, gridsLength: grids.length}));
    let resultTwo = await store.dispatch(deleteArray({num: arrays.length, arraysLength: arrays.length}));
    arrays = store.getState().arrays;
    grids = store.getState().grids;
    //Validate that there are no structs
    expect(grids.length).toEqual(0);
    expect(arrays.length).toEqual(0);
})

describe("totalStructsSlice redux state tests", () => {
    test("if addGrid increments totalStructs", async () => {
        let totalStructs = store.getState().totalStructs;
        expect(totalStructs).toEqual(0);
        let result = await store.dispatch(addGrid({num: 2}));
        expect(result.payload.num).toEqual(2);
        expect(result.type).toEqual("addGrid");
        totalStructs = store.getState().totalStructs;
        expect(totalStructs).toEqual(2);
    })

    test("if deleteGrid decrements totalStructs", async () => {
        let result = await store.dispatch(addGrid({num: 10}));
        let totalStructs = store.getState().totalStructs;
        expect(totalStructs).toEqual(10);
        let grids = store.getState().grids
        result = await store.dispatch(deleteGrid({num: 3, gridsLength: grids.length}));
        totalStructs = store.getState().totalStructs;
        expect(totalStructs).toEqual(7);
    })

    test("if addGraph increments totalStructs", async () => {
        await store.dispatch(addGraph({}));
        await store.dispatch(addGraph({}));
        await store.dispatch(addGraph({}));
        await store.dispatch(addGraph({}));
        await store.dispatch(addGraph({}));
        let totalStructs = store.getState().totalStructs;
        expect(totalStructs).toEqual(5);
    })

    test("if deleteGraph decrements totalStructs", async () => {
        await store.dispatch(addGraph({}));
        await store.dispatch(addGraph({}));
        await store.dispatch(addGraph({}));
        await store.dispatch(addGraph({}));
        await store.dispatch(addGraph({}));
        await store.dispatch(deleteGraph({num: 3}));
        let totalStructs = store.getState().totalStructs;
        expect(totalStructs).toEqual(2);
    })
 
})