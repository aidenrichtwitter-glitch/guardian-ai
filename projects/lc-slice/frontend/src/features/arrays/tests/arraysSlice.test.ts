import { deleteArray, addArray, copyArray, deleteAllStructs} from "../../sharedActions"
import { addPointer, popData, pushData } from "../arraysSlice";
import {store} from "../../store"

beforeEach(async () => {
    await store.dispatch(deleteAllStructs());
})

describe('arraysSlice redux state tests', () => {
    test("if addArray functions", async () => {
        let result = await store.dispatch(addArray({num: 3}));
        expect(result.type).toEqual("addArray");
        let arrays = store.getState().arrays;
        expect(arrays.length).toEqual(3);
        //Each array should start out with only one value
        for (let i = 0; i < 3; i++) {
            expect(arrays[i].width).toEqual(1);
            expect(arrays[i].data.length).toEqual(1);
            expect(arrays[i].data[0].data).toEqual(0);
            expect(arrays[i].data[0].status).toEqual("UNEXPLORED");
        }
    })
    test("if deleteArray functions", async () => {
        let result = await store.dispatch(addArray({num: 5}));
        let arrays = store.getState().arrays;
        expect(arrays.length).toEqual(5);
        result = await store.dispatch(deleteArray({num: 2, arraysLength: arrays.length}));
        expect(result.type).toEqual("deleteArray");
        arrays = store.getState().arrays;
        expect(arrays.length).toEqual(3);
        expect(arrays[4]).toBeUndefined();
        expect(arrays[5]).toBeUndefined();
    })

    test("if adding then deleting all arrays works", async () => {
        await store.dispatch(addArray({num: 5}));
        await store.dispatch(deleteArray({num: 5, arraysLength: 5}))
        let arrays = store.getState().arrays;
        expect(arrays.length).toEqual(0);
        expect(arrays).toEqual([]);
    })

    test("if copyArray works", async () => {
        let result = await store.dispatch(copyArray({data: [1, 2, 3, 4, 5]}))
        expect(result.type).toEqual("copyArray");
        result = await store.dispatch(copyArray({data: [2]}));
        let arrays = store.getState().arrays;
        expect(arrays.length).toEqual(2);
        expect(arrays[0].width).toEqual(5);
        expect(arrays[0].data).toEqual([
            {data: 1, status: "UNEXPLORED"},
            {data: 2, status: "UNEXPLORED"},
            {data: 3, status: "UNEXPLORED"},
            {data: 4, status: "UNEXPLORED"},
            {data: 5, status: "UNEXPLORED"}
        ]);
        expect(arrays[1].width).toEqual(1);
        expect(arrays[1].data).toEqual([
            {data: 2, status: "UNEXPLORED"}
        ]);
    })

    test("if pushData works", async () => {
        //Copy initial arrays
        await store.dispatch(copyArray({data: [1, 2, 3, 4, 5]}))
        await store.dispatch(copyArray({data: [2]}));
        //Push new data to both arrays
        let result = await store.dispatch(pushData({
            arrayIndex: 0, 
            data: [6, 7, 8]
        }));
        expect(result.type).toEqual("arrays/pushData");
        result = await store.dispatch(pushData({
            arrayIndex: 1,
            data: [3]
        }));
        let arrays = store.getState().arrays;
        expect(arrays[0].width).toEqual(8);
        expect(arrays[0].data[5]).toEqual({data: 6, status: "UNEXPLORED"});
        expect(arrays[0].data[6]).toEqual({data: 7, status: "UNEXPLORED"});
        expect(arrays[0].data[7]).toEqual({data: 8, status: "UNEXPLORED"});
        expect(arrays[1].width).toEqual(2);
        expect(arrays[1].data[0]).toEqual({data: 2, status: "UNEXPLORED"});
        expect(arrays[1].data[1]).toEqual({data: 3, status: "UNEXPLORED"});
    })

    test("if popData works", async () => {
        await store.dispatch(copyArray({data: [1, 2, 3, 4, 5]}))
        let result = await store.dispatch(popData({
            arrayIndex: 0, 
            num: 3
        }));
        expect(result.type).toEqual("arrays/popData");
        let arrays = store.getState().arrays
        expect(arrays[0].width).toEqual(2);
        expect(arrays[0].data).toEqual([
            {data: 1, status: "UNEXPLORED"},
            {data: 2, status: "UNEXPLORED"}
        ])
    })

    test("if addPointer works with no default location", async () => {
        await store.dispatch(copyArray({data: [1, 2, 3, 4, 5]}));
        await store.dispatch(copyArray({data: [6, 7, 8, 9, 10]}));
        let arrays = store.getState().arrays;
        expect(arrays.length).toEqual(2);
        //Add three pointers to array one
        let result = await store.dispatch(addPointer({arrayIndex: 0}));
        expect(result.type).toEqual("arrays/addPointer");
        await store.dispatch(addPointer({arrayIndex: 0}));
        await store.dispatch(addPointer({arrayIndex: 0}));
        //Add two pointers to array two
        await store.dispatch(addPointer({arrayIndex: 1}));
        await store.dispatch(addPointer({arrayIndex: 1}));
        arrays = store.getState().arrays
        //First array should have three pointers
        expect(arrays[0].pointerLocations.length).toEqual(3)
        //Second array should have 2
        expect(arrays[1].pointerLocations.length).toEqual(2);
        //Each pointer in array one should have the default position.
        expect(arrays[0].pointerLocations[0]).toEqual(0);
        expect(arrays[0].pointerLocations[1]).toEqual(0);
        expect(arrays[0].pointerLocations[2]).toEqual(0);
        //Each pointer in array two should have the default position.
        expect(arrays[1].pointerLocations[0]).toEqual(0);
        expect(arrays[1].pointerLocations[1]).toEqual(0);
    })

    test("if addPointer works with default location", async () => {
        //Create two arrays
        await store.dispatch(copyArray({data: [1, 2, 3, 4, 5]}));
        await store.dispatch(copyArray({data: [5, 6, 7, 8, 9]}));
        //Add two pointers to array one
        await store.dispatch(addPointer({arrayIndex: 0, location: 3}));
        await store.dispatch(addPointer({arrayIndex: 0, location: 2}));
        //Add a pointer to array two
        await store.dispatch(addPointer({arrayIndex: 1, location: 4}));
        let arrays = store.getState().arrays
        expect(arrays[0].pointerLocations[0]).toEqual(3);
        expect(arrays[0].pointerLocations[1]).toEqual(2);
        expect(arrays[1].pointerLocations[0]).toEqual(4);
    })

    test("if addPointer will fail given invalid parameters", async () => {
        await store.dispatch(copyArray({data: [1, 2, 3, 4, 5]}));
        //Fails due to low index
        await store.dispatch(addPointer({arrayIndex: -1, location: 3}));
        //Fails due to high index
        await store.dispatch(addPointer({arrayIndex: 40, location: -1}));
        //Fails and pushes default value
        await store.dispatch(addPointer({arrayIndex: 0, location: -1}));
        //Fails due to low index
        await store.dispatch(addPointer({arrayIndex: -1, location: -5}));
        let arrays = store.getState().arrays;
        expect(arrays[0].pointerLocations.length).toEqual(1);
        expect(arrays[0].pointerLocations[0]).toEqual(0);
    })

    test("if movePointer works", async () => {
        await store.dispatch(copyArray({data: [1, 2, 3, 4, 5]}));
        await store.dispatch(copyArray({data: [5, 6, 7, 8, 9]}));
    })
})