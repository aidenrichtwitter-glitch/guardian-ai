import React, {useEffect,  useRef, useState, useLayoutEffect, useCallback, FormEvent, ChangeEvent} from "react"
import {NodeInner} from "../Node"
import "./linkedlist.css"
import {gsap} from "gsap"
import { Flip } from "gsap/Flip"
import { useAppDispatch, useAppSelector } from "../../../features/hooks"
import { disconnectNode, pushListNode } from "../../../features/linkedLists/linkedListsSlice"
import { useImmer } from "use-immer"


type GridNodeType = {
  gridIndex: number,
  nodeIndex: number | null,
  data: number | null,
  status: string,
}

type LayoutType = {
  state: Flip.FlipState,
  gridNodes: GridNodeType[]
}

gsap.registerPlugin(Flip);

export const LinkedList = () => {
  /* GSAP CSS SELECTORS */
  const baseRef = useRef<HTMLDivElement>(null);
  const queryBaseRef = gsap.utils.selector(baseRef);

  /* REDUX SELECTORS */
  const listData = useAppSelector(state => state.linkedLists[0] ? 
      state.linkedLists[0].listData : 
      [1, 2, 3, 4, 5]
  );
  const instruction = useAppSelector(state => state.linkedLists[0] ? 
      state.linkedLists[0].instruction : 
      {operateOnNode: -1, performOperation: "DO_NOTHING"}
  )
  const connectRight = useAppSelector(state => state.linkedLists[0] ? 
      state.linkedLists[0].connectRight : 
      [true, true, true, true, false]
  );
  const nodeStatusData = useAppSelector(state => state.linkedLists[0] ? 
    state.linkedLists[0].nodeStatusData : 
    ["NO_STATUS", "NO_STATUS", "NO_STATUS", "NO_STATUS", "NO_STATUS"]
  )

  /* GSAP CONTEXT CREATION */
  const [context] = useState(() => gsap.context(() => {}));
  useEffect(() => {
    return () => context.revert();
  }, [])

  /* REACT STATE OBJECTS */
  const [firstInput, setFirstInput] = useState<number>(0);
  const [secondInput, setSecondInput] = useState<number>(0);
  const [layout, setLayout] = useState<LayoutType>(() => ({
    gridNodes: [
      ...listData.map((data, idx) => ({gridIndex: idx, nodeIndex: idx, data: data, status: nodeStatusData[idx] ? nodeStatusData[idx] : "NO_STATUS"})),
      ...listData.map((data, idx) => ({gridIndex: idx + listData.length, nodeIndex: null, data: null, status: "NO_STATUS"})),
    ],
    state: Flip.getState(queryBaseRef(".linked_list_node")),
  }))
  const dispatch = useAppDispatch();

  const changeFirstInput = (e: ChangeEvent<HTMLInputElement>) => {
    setFirstInput(parseInt(e.target.value));
  }

  const changeSecondInput = (e: ChangeEvent<HTMLInputElement>) => {
    setSecondInput(parseInt(e.target.value));
  }

  const createStyleStuff = () => {
    const columnTemplate: string = [...Array(listData.length)].map(item => "100px ").join("");
    return {"gridTemplateColumns": columnTemplate}
  }

  const removeItems = useCallback((exitingItems: GridNodeType[]) => {
    if (!exitingItems.length) {return}

    /*setLayout(prev => ({
      state: Flip.getState(queryBaseRef(".linked_list_node")),
      gridNodes: prev.gridNodes.filter(node => !exitingItems.includes(node))
    })); */

  }, [queryBaseRef])

  const shuffle = () => {
    setLayout({
      state: Flip.getState(queryBaseRef(".linked_list_node")),
      gridNodes: [...gsap.utils.shuffle(layout.gridNodes)],
    })
  }

  const replaceGridNodeWithDiv = (idx: number) => {
    const nodeRemoved = layout.gridNodes[idx];
    nodeRemoved.data = null; nodeRemoved.nodeIndex = null;
    setLayout({
      state: Flip.getState(queryBaseRef(".linked_list_node")),
      gridNodes: [
        ...layout.gridNodes.slice(0, idx),
        nodeRemoved,
        ...layout.gridNodes.slice(idx + 1)
      ]
    })
  }

  const swapNodes = (idx1: number, idx2: number) => {
    if (idx1 === idx2 || idx1 < 0 || idx1 >= listData.length * 2 || idx2 < 0 || idx2 >= listData.length * 2) {
      return;
    }
    [idx1, idx2] = idx1 > idx2 ? [idx2, idx1] : [idx1, idx2];
    console.log(idx1, idx2);
    const moveFirstNode = layout.gridNodes[idx1];
    const moveSecondNode = layout.gridNodes[idx2];
    setLayout({
      state: Flip.getState(queryBaseRef(".linked_list_node")),
      gridNodes: [
        ...layout.gridNodes.slice(0, idx1),
        moveSecondNode,
        ...layout.gridNodes.slice(idx1 + 1, idx2), 
        moveFirstNode, 
        ...layout.gridNodes.slice(idx2 + 1),
      ],
    }) 
  }


  const swapRow = (idx: number) => {
    //Get indexes of affected positions
    const nodeMoveDownIndex = idx;
    const nodeMoveUpIndex = idx + listData.length;
    //Find node to move down
    const nodeMoveDown = layout.gridNodes[nodeMoveDownIndex];
    //Get empty div/grid node to move up
    const nodeMoveUp = layout.gridNodes[nodeMoveUpIndex];
    //Update empty div/grid node's gridInde
    setLayout({
      state: Flip.getState(queryBaseRef(".linked_list_node")),
      gridNodes: [
        ...layout.gridNodes.slice(0, nodeMoveDownIndex), 
        nodeMoveUp, 
        ...layout.gridNodes.slice(nodeMoveDownIndex + 1, nodeMoveUpIndex),
        nodeMoveDown,
        ...layout.gridNodes.slice(nodeMoveUpIndex + 1)
      ],
    }) 
  }

  const shiftListNodeLeft = (listNodeIndex: number) => {
    const nodeToMove = layout.gridNodes[listNodeIndex];
    const nodesToShift = listNodeIndex < listData.length ? 
      layout.gridNodes.slice(0, listNodeIndex) : 
      layout.gridNodes.slice(listData.length, listNodeIndex);
    const unaffectedNodes = listNodeIndex < listData.length ? 
      [] : 
      layout.gridNodes.slice(0, listData.length);
    const anchorIndex = listNodeIndex + 1;
    setLayout({
      state: Flip.getState(queryBaseRef(".linked_list_node")),
      gridNodes: [
        ...unaffectedNodes,
        nodeToMove, 
        ...nodesToShift,
        ...layout.gridNodes.slice(anchorIndex),
      ]
    })
  }

  const shiftListNodeRight = (listNodeIndex: number) => {
    
  }

  const slideListNodeLeft = (listNodeIndex: number) => {
    if (listNodeIndex === 0 || listNodeIndex === listData.length || listNodeIndex >= listData.length) {
      return;
    }
    const nodeToMove = layout.gridNodes[listNodeIndex];
    if (listNodeIndex < listData.length) {
      const leftEdgeNode = layout.gridNodes[0];
      setLayout({
        state: Flip.getState(queryBaseRef(".linked_list_node")),
        gridNodes: [
          nodeToMove, 
          ...layout.gridNodes.slice(1, listNodeIndex),
          leftEdgeNode,
          ...layout.gridNodes.slice(listNodeIndex + 1)
        ]
      })
      return;
    }
    const leftEdgeNode = layout.gridNodes[listNodeIndex < listData.length ? 0 : listData.length];
    setLayout({
      state: Flip.getState(queryBaseRef(".linked_list_node")),
      gridNodes: [
        ...layout.gridNodes.slice(0, listData.length),
        nodeToMove, 
        ...layout.gridNodes.slice(listData.length + 1, listNodeIndex),
        leftEdgeNode,
        ...layout.gridNodes.slice(listNodeIndex + 1),
      ],
    }) 
    return; 
  }

  useEffect(() => {
    if (
      listData.length === 0 || 
      instruction.performOperation === "DO_NOTHING" || 
      instruction.operateOnNode < 0 || 
      instruction.operateOnNode >= listData.length
    ) {
      return;
    }
    switch (instruction.performOperation) {
      case "DISCONNECT_NODE": {
        swapRow(instruction.operateOnNode);
      } break;
    }
  }, [instruction])

  useLayoutEffect(() => {
    if (!layout.state) {
      return;
    }
    context.add(() => {
      const timeline = Flip.from(layout.state, {
        absolute: true, 
        ease: "power1.inOut",
        targets: queryBaseRef(".linked_list_node"),
        scale: true,
        simple: true,
        onEnter: elements => {
          return gsap.fromTo(elements, { 
            opacity: 0,
            scale: 0
          }, { 
            opacity: 1,
            scale: 1,
            delay: 0.2,
            duration: 0.3
          });
        },
        onLeave: elements => {
          return gsap.fromTo(elements, { 
            opacity: 1, 
            scale: 1,
          }, {
            opacity: 0,
            scale: 1,
            delay: 0.2,
            duration: 0.3
          }
          );
        }
      })
    })
  }, [context, layout]);


  return (
    <div className="linked_list" ref={baseRef}>
      <button onClick={() => {swapRow(firstInput)}}>Swap Row</button>
      <button onClick={() => {slideListNodeLeft(4)}}>Slide</button>
      <button onClick={() => {replaceGridNodeWithDiv(firstInput)}}>Empty Node</button>
      <button onClick={() => {swapNodes(firstInput, secondInput)}}>Swap Nodes</button>
      <input 
        type="number"
        min={0}
        max={listData.length * 2 - 1}
        step={1}
        onChange={changeFirstInput}
        value={firstInput}
      />
      <input 
        type="number"
        min={0}
        max={listData.length * 2 - 1}
        step={1}
        onChange={changeSecondInput}
        value={secondInput}
      />
      <div style={createStyleStuff()} className="linked_list_grid_container">
        {layout.gridNodes.map(node => {
          if (node.data !== null && node.nodeIndex !== null) {
            return (
              <div 
                key={`Linked_List_Grid_Node_Full${node.gridIndex}`}
                className="linked_list_node"
                data-flip-id={`linked_list_node_${node.gridIndex}`}
              >
                <div 
                  key={`Linked List_Node_Circle${node.nodeIndex}`} 
                  className="circle">
                    {listData[node.nodeIndex]}
                </div>
                <div className="arrow_head">
                  <div 
                    key={`Linked_List_Node_Arrow_${node.gridIndex}`} 
                    className="arrow"
                  />
                  <div 
                    key={`Linked_List_Node_Arrow_Tip${node.gridIndex}`} 
                    className="tip"
                  />
                </div>
              </div>
            );
          } else {
            return (
              <div 
                key={`Linked_List_Grid_Node_Empty${node.gridIndex}`}
                data-flip-id={`linked_list_node_${node.gridIndex}`}
              />
            );
          }
        })}
      </div>
    </div>
  );
}