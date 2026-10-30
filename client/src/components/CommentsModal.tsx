import type { ComponentProps } from "react";
import DraggableModal from "./DraggableModal";
import CommentThread from "./CommentThread";

// Same props as CommentThread, plus open/close
type Props = ComponentProps<typeof CommentThread> & {
  open: boolean;
  onClose: () => void;
};

export default function CommentsModal({ open, onClose, ...thread }: Props) {
  return (
    <DraggableModal open={open} onClose={onClose} title={`Comments (${thread.comments.length})`} scroll={false}>
      {/* CommentThread pins its composer and scrolls its own list */}
      <CommentThread {...thread} />
    </DraggableModal>
  );
}