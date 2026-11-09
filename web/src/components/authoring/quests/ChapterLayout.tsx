import { useEffect, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  Handle,
  Position,
  MarkerType,
  type NodeProps,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import '../../../styles/graph.css'
import Button from '../../ui/Button'
const LAYOUT_UNIT = 48
type QuestNode = Node<{ label: string }, 'quest'>
function QuestNodeView({ data }: NodeProps<QuestNode>) {
  return (
    <div className="flow-node">
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <span className="flow-node-title">{data.label}</span>
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  )
}
const nodeTypes = { quest: QuestNodeView }
function Layout({
  quests,
  titles,
  selected,
  onSelect,
  onPosition,
}: {
  quests: any[]
  titles: Record<string, any>
  selected: string
  onSelect: (id: string) => void
  onPosition: (id: string, x: number, y: number) => void
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<QuestNode>([]),
    flow = useReactFlow(),
    [interacting, setInteracting] = useState(false)
  const signature = JSON.stringify(
    quests.map((row) => [row.id, row.x, row.y, titles[row.id]?.title]),
  )
  useEffect(() => {
    if (interacting) return
    setNodes(
      quests.map((row) => ({
        id: row.id,
        type: 'quest',
        position: { x: row.x * LAYOUT_UNIT, y: row.y * LAYOUT_UNIT },
        data: { label: titles[row.id]?.title ?? row.key },
        selected: row.id === selected,
        ariaLabel: titles[row.id]?.title ?? row.key,
      })),
    )
  }, [signature, selected, interacting])
  const ids = new Set(quests.map((row) => row.id)),
    external = quests.some((row) =>
      row.dependencies.some((id: string) => !ids.has(id)),
    )
  const edges = quests.flatMap((row) =>
    row.dependencies
      .filter((id: string) => ids.has(id))
      .map((id: string) => ({
        id: id + '/' + row.id,
        source: id,
        target: row.id,
        markerEnd: { type: MarkerType.ArrowClosed },
      })),
  )
  return (
    <section className="content-stack quest-layout" aria-label="Chapter layout">
      <div className="quest-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={(_, node) => onSelect(node.id)}
          onNodeDragStart={() => setInteracting(true)}
          onNodeDragStop={(_, node) => {
            setInteracting(false)
            onPosition(
              node.id,
              Math.round((node.position.x / LAYOUT_UNIT) * 100) / 100,
              Math.round((node.position.y / LAYOUT_UNIT) * 100) / 100,
            )
          }}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          minZoom={0.1}
          maxZoom={2}
          nodesConnectable={false}
          deleteKeyCode={null}
        />
      </div>
      <div className="action-row">
        <Button onClick={() => flow.zoomIn()}>Zoom in</Button>
        <Button onClick={() => flow.zoomOut()}>Zoom out</Button>
        <Button onClick={() => flow.fitView({ padding: 0.12 })}>
          Fit chapter
        </Button>
      </div>
      <p className="scope">
        Drag to arrange quests, or edit X/Y under Links. This uses saved
        coordinates; native fonts and icon sizes differ.
        {external
          ? ' Prerequisites from other chapters appear under Links.'
          : ''}
      </p>
    </section>
  )
}
export default function ChapterLayout(props: Parameters<typeof Layout>[0]) {
  return (
    <ReactFlowProvider>
      <Layout {...props} />
    </ReactFlowProvider>
  )
}
