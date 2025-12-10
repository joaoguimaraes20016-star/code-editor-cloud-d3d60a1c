import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Smile, Paperclip, Loader2 } from "lucide-react";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
    email: string | null;
  };
}

export function TeamChatPage() {
  const { teamId } = useParams();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadMessages = async () => {
    if (!teamId) return;
    
    const { data, error } = await supabase
      .from("team_messages")
      .select(`
        *,
        profile:profiles!team_messages_user_id_fkey(full_name, avatar_url, email)
      `)
      .eq("team_id", teamId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setMessages(data.map(msg => ({
        ...msg,
        profile: Array.isArray(msg.profile) ? msg.profile[0] : msg.profile
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadMessages();

    const channel = supabase
      .channel(`team-chat-${teamId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "team_messages",
          filter: `team_id=eq.${teamId}`,
        },
        async (payload) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, avatar_url, email")
            .eq("id", payload.new.user_id)
            .single();

          const newMsg: Message = {
            ...(payload.new as any),
            profile: profile || undefined,
          };
          setMessages((prev) => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !user || !teamId || sending) return;

    setSending(true);
    const { error } = await supabase.from("team_messages").insert({
      team_id: teamId,
      user_id: user.id,
      message: newMessage.trim(),
    });

    if (!error) {
      setNewMessage("");
    }
    setSending(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const formatMessageTime = (date: string) => {
    return format(new Date(date), "h:mm a");
  };

  const formatDateDivider = (date: string) => {
    const d = new Date(date);
    if (isToday(d)) return "Today";
    if (isYesterday(d)) return "Yesterday";
    return format(d, "MMMM d, yyyy");
  };

  const shouldShowDateDivider = (currentMsg: Message, prevMsg?: Message) => {
    if (!prevMsg) return true;
    return !isSameDay(new Date(currentMsg.created_at), new Date(prevMsg.created_at));
  };

  const shouldGroupWithPrevious = (currentMsg: Message, prevMsg?: Message) => {
    if (!prevMsg) return false;
    if (currentMsg.user_id !== prevMsg.user_id) return false;
    const timeDiff = new Date(currentMsg.created_at).getTime() - new Date(prevMsg.created_at).getTime();
    return timeDiff < 5 * 60 * 1000; // 5 minutes
  };

  const isOwnMessage = (msg: Message) => msg.user_id === user?.id;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-card">
        <h1 className="text-xl font-semibold text-foreground">Team Chat</h1>
        <p className="text-sm text-muted-foreground">
          {messages.length} messages
        </p>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 px-6" ref={scrollAreaRef}>
        <div className="py-4 space-y-1">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Send className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-foreground">No messages yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Start the conversation with your team
              </p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const prevMsg = messages[index - 1];
              const showDateDivider = shouldShowDateDivider(msg, prevMsg);
              const isGrouped = shouldGroupWithPrevious(msg, prevMsg);
              const isOwn = isOwnMessage(msg);

              return (
                <div key={msg.id}>
                  {showDateDivider && (
                    <div className="flex items-center justify-center py-4">
                      <div className="bg-muted px-3 py-1 rounded-full">
                        <span className="text-xs text-muted-foreground font-medium">
                          {formatDateDivider(msg.created_at)}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  <div className={cn(
                    "flex gap-3",
                    isOwn && "flex-row-reverse",
                    isGrouped && !showDateDivider ? "mt-0.5" : "mt-4"
                  )}>
                    {/* Avatar - only show for first message in group */}
                    {!isGrouped || showDateDivider ? (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={msg.profile?.avatar_url || undefined} />
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {getInitials(msg.profile?.full_name || msg.profile?.email)}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="w-8 shrink-0" />
                    )}

                    <div className={cn(
                      "flex flex-col max-w-[70%]",
                      isOwn && "items-end"
                    )}>
                      {/* Name and time - only show for first message in group */}
                      {(!isGrouped || showDateDivider) && (
                        <div className={cn(
                          "flex items-center gap-2 mb-1",
                          isOwn && "flex-row-reverse"
                        )}>
                          <span className="text-sm font-medium text-foreground">
                            {isOwn ? "You" : (msg.profile?.full_name || msg.profile?.email || "Unknown")}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatMessageTime(msg.created_at)}
                          </span>
                        </div>
                      )}
                      
                      {/* Message bubble */}
                      <div className={cn(
                        "px-4 py-2 rounded-2xl",
                        isOwn 
                          ? "bg-primary text-primary-foreground rounded-br-md" 
                          : "bg-muted text-foreground rounded-bl-md"
                      )}>
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {msg.message}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="px-6 py-4 border-t border-border bg-card">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-foreground">
            <Paperclip className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-foreground">
            <Smile className="h-5 w-5" />
          </Button>
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 bg-muted border-0 focus-visible:ring-1"
          />
          <Button 
            onClick={handleSend} 
            disabled={!newMessage.trim() || sending}
            size="icon"
            className="shrink-0"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
