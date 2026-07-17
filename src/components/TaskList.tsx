import { useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'
import TaskCard from './TaskCard'
import type { Task } from '../store/appStore'

interface TaskListProps {
    tasks: Task[]
    onRemove: (id: string) => void
    onFormatChange: (id: string, format: string) => void
    onEditMetadata: (id: string) => void
}

export default function TaskList({ tasks, onRemove, onFormatChange, onEditMetadata }: TaskListProps) {
    // Limit list rendering to 100 items to avoid DOM lag with thousands of files
    const visibleTasks = useMemo(() => {
        return tasks.slice(0, 100)
    }, [tasks])

    return (
        <div className="flex-1 overflow-y-auto pr-1 -mr-1 custom-scrollbar flex flex-col gap-2">
            <div className="space-y-2 pb-2">
                <AnimatePresence mode="popLayout">
                    {visibleTasks.map(task => (
                        <TaskCard
                            key={task.id}
                            id={task.id}
                            name={task.file.name}
                            status={task.status}
                            progress={task.progress}
                            targetFormat={task.targetFormat}
                            originalSize={task.originalSize}
                            convertedSize={task.convertedSize}
                            outputPath={task.outputPath}
                            availableFormats={task.availableFormats}
                            onRemove={() => onRemove(task.id)}
                            onFormatChange={(fmt) => onFormatChange(task.id, fmt)}
                            onEditMetadata={() => onEditMetadata(task.id)}
                        />
                    ))}
                </AnimatePresence>
            </div>
            {tasks.length > 100 && (
                <div className="text-center py-2.5 text-neutral-500 font-mono text-[10px] bg-[#070707] border border-dashed border-[#1a1a1a] rounded text-neutral-400 select-none animate-pulse">
                    + {tasks.length - 100} more files in queue...
                </div>
            )}
        </div>
    )
}
