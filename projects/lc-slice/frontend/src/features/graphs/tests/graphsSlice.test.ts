import {addGraph, deleteAllStructs} from "../../sharedActions"
import {store} from "../../store"
import {addNode} from "../graphsSlice"
import {RootState, GraphNode} from "../../../utils/types"



beforeEach(async () => {
    await store.dispatch(deleteAllStructs());
})

describe('gridsSlice redux state tests', () => {

    test("if add graph works", async () => {
        let graphs: RootState["graphs"] = store.getState().graphs;
        expect(graphs).toEqual([]);
        expect(graphs.length).toEqual(0);
        await store.dispatch(addGraph({}));
        await store.dispatch(addGraph({
            nodeRadius: 30,
            directed: true,
            weighted: true,
            connected: true,
            edgeLabels: ["Total", "Drama", "Island"],
            label: "Interesting Grid",
        }))
        graphs = store.getState().graphs;
        expect(graphs.length).toEqual(2);
        expect(graphs[0]).toEqual({
            nodeRadius: 20,
            directed: false,
            weighted: false,
            connected: false,
            edgeLabels: [],
            label: "GRID_1",
            nodes: [],
        });
        expect(graphs[1]).toEqual({
            nodeRadius: 30,
            directed: true,
            weighted: true,
            connected: true,
            edgeLabels: ["Total", "Drama", "Island"],
            label: "Interesting Grid",
            nodes: [],
        });
    })
    
    test("if addNode works with default node", async () => {
        let graphs = store.getState().graphs;
        expect(graphs.length).toEqual(0);
        await store.dispatch(addGraph({}));
        await store.dispatch(addGraph({}));
        await store.dispatch(addNode({graphIndex: 0}));
        graphs = store.getState().graphs;
        expect(graphs[1].nodes).toEqual([]);
        expect(graphs[0].nodes).toEqual([
            {
                data: 0,
                name: "GRAPH_1_NODE_1",
                links: [],
                initX: 200,
                initY: 200,
            }
        ])
    })

    test("if addNode works with multiple nodes", async () => {
        let graphs = store.getState().graphs;
        expect(graphs.length).toEqual(0);
        await store.dispatch(addGraph({}));
        await store.dispatch(addGraph({}));
        await store.dispatch(addNode({graphIndex: 0}));
        await store.dispatch(addNode({graphIndex: 0}));
        await store.dispatch(addNode({graphIndex: 1}));
        await store.dispatch(addNode({graphIndex: 1}));
        graphs = store.getState().graphs;
        expect(graphs[0].nodes.length).toEqual(2);
        expect(graphs[1].nodes.length).toEqual(2);
        expect(graphs[0].nodes).toEqual([
            {
                data: 0,
                name: "GRAPH_1_NODE_1",
                links: [],
                initX: 200,
                initY: 200,
            },
            {
                data: 0,
                name: "GRAPH_1_NODE_2",
                links: [],
                initX: 200,
                initY: 200,
            }
        ]);

        expect(graphs[1].nodes).toEqual([
            {
                data: 0,
                name: "GRAPH_2_NODE_1",
                links: [],
                initX: 200,
                initY: 200,
            },
            {
                data: 0,
                name: "GRAPH_2_NODE_2",
                links: [],
                initX: 200,
                initY: 200,
            }
        ]);
    })

    test("if addNode works with constructed nodes", async () => {
        await store.dispatch(addGraph({}));
        await store.dispatch(addNode({
            graphIndex: 0, 
            data: 24,
            name: "Interesting Node",
            links: [0, 1, 2],
            initX: 400, 
            initY: 500,
        }));

        let graphs = store.getState().graphs;
        expect(graphs[0].nodes).toEqual([
            {
                data: 24,
                name: "Interesting Node",
                links: [0, 1, 2],
                initX: 400, 
                initY: 500,
            }
        ])
    })

    test("if addNode fails on invalid index", async () => {
        await store.dispatch(addGraph({}))
        await store.dispatch(addGraph({}))
        await store.dispatch(addNode({graphIndex: -1}))
        await store.dispatch(addNode({graphIndex: 40}))
        let graphs = store.getState().graphs;
        expect(graphs[0].nodes).toEqual([]);
        expect(graphs[1].nodes).toEqual([]);
    })
})