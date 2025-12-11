import { useParams } from "react-router-dom";
import TeamChat from "@/components/TeamChat";

export function TeamChatPage() {
  const { teamId } = useParams();

  if (!teamId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No team selected</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)]">
      <TeamChat teamId={teamId} />
    </div>
  );
}