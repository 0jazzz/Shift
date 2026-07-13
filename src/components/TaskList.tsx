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
    return (
        <div className="flex-1 overflow-y-auto pr-1 -mr-1 custom-scrollbar">
            <div className="space-y-2 pb-2">
                <AnimatePresence mode="popLayout">
                    {tasks.map(task => (
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
        </div>
    )
}
