import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, MessageSquare, Mic, Square, Image as ImageIcon, X, Play, Pause } from 'lucide-react';
import { toast } from 'sonner';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  user_id: string;
  message: string;
  file_url?: string | null;
  file_type?: string | null;
  voice_duration?: number | null;
  created_at: string;
  profiles?: {
    full_name: string | null;
    avatar_url?: string | null;
  };
}

interface TeamChatProps {
  teamId: string;
}

export default function TeamChat({ teamId }: TeamChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    try {
      const { data: messagesData, error: messagesError } = await supabase
        .from('team_messages')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      if (!messagesData || messagesData.length === 0) {
        setMessages([]);
        return;
      }

      const userIds = [...new Set(messagesData.map(m => m.user_id))];

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      const profilesMap = new Map(
        (profilesData || []).map(p => [p.id, p])
      );

      const messagesWithProfiles = messagesData.map(msg => ({
        ...msg,
        profiles: profilesMap.get(msg.user_id),
      }));

      setMessages(messagesWithProfiles);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();

    const channel = supabase
      .channel(`team-messages-${teamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_messages',
          filter: `team_id=eq.${teamId}`,
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || sending) return;

    setSending(true);
    const messageText = newMessage.trim();
    setNewMessage('');

    try {
      const { error } = await supabase
        .from('team_messages')
        .insert({
          team_id: teamId,
          user_id: user.id,
          message: messageText,
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      setNewMessage(messageText);
    } finally {
      setSending(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setSending(true);
    try {
      const fileName = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('team-chat-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('team-chat-files')
        .getPublicUrl(fileName);

      const { error } = await supabase
        .from('team_messages')
        .insert({
          team_id: teamId,
          user_id: user.id,
          message: '',
          file_url: publicUrl,
          file_type: 'image',
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    } finally {
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        await uploadVoiceMessage(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.error('Could not access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      setRecordingTime(0);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const uploadVoiceMessage = async (audioBlob: Blob) => {
    if (!user) return;

    setSending(true);
    try {
      const fileName = `${user.id}/${Date.now()}_voice.webm`;
      const { error: uploadError } = await supabase.storage
        .from('team-chat-files')
        .upload(fileName, audioBlob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('team-chat-files')
        .getPublicUrl(fileName);

      const { error } = await supabase
        .from('team_messages')
        .insert({
          team_id: teamId,
          user_id: user.id,
          message: '',
          file_url: publicUrl,
          file_type: 'voice',
          voice_duration: recordingTime,
        });

      if (error) throw error;
      setRecordingTime(0);
    } catch (error) {
      console.error('Error uploading voice message:', error);
      toast.error('Failed to upload voice message');
    } finally {
      setSending(false);
    }
  };

  const toggleAudioPlayback = (messageId: string, audioUrl: string) => {
    let audio = audioRefs.current.get(messageId);
    
    if (!audio) {
      audio = new Audio(audioUrl);
      audioRefs.current.set(messageId, audio);
      
      audio.onended = () => {
        setPlayingAudioId(null);
      };
    }

    if (playingAudioId === messageId) {
      audio.pause();
      setPlayingAudioId(null);
    } else {
      // Pause any currently playing audio
      if (playingAudioId) {
        const currentAudio = audioRefs.current.get(playingAudioId);
        currentAudio?.pause();
      }
      audio.play();
      setPlayingAudioId(messageId);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getUserInitials = (name: string | null | undefined) => {
    if (!name) return '?';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatMessageTime = (date: Date) => {
    return format(date, 'h:mm a');
  };

  const formatDateHeader = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  };

  // Group messages by date and consecutive sender
  const groupedMessages = messages.reduce((acc, msg, index) => {
    const msgDate = new Date(msg.created_at);
    const prevMsg = messages[index - 1];
    const prevMsgDate = prevMsg ? new Date(prevMsg.created_at) : null;
    
    // Check if we need a date header
    const needsDateHeader = !prevMsgDate || !isSameDay(msgDate, prevMsgDate);
    
    const isSameUser = prevMsg && prevMsg.user_id === msg.user_id;
    const timeDiff = prevMsg 
      ? (msgDate.getTime() - new Date(prevMsg.created_at).getTime()) / 1000 / 60
      : Infinity;
    const isGrouped = isSameUser && timeDiff < 5 && !needsDateHeader;

    if (needsDateHeader) {
      acc.push({ type: 'date', date: msgDate, id: `date-${msg.id}` });
    }

    acc.push({ 
      type: 'message', 
      ...msg, 
      isGroupStart: !isGrouped 
    });
    
    return acc;
  }, [] as (({ type: 'date'; date: Date; id: string }) | (Message & { type: 'message'; isGroupStart: boolean }))[]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0b141a] overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="p-4 rounded-full bg-muted/20 mb-4">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium text-foreground">No messages yet</p>
            <p className="text-sm text-muted-foreground">Start the conversation!</p>
          </div>
        ) : (
          groupedMessages.map((item) => {
            if (item.type === 'date') {
              return (
                <div key={item.id} className="flex justify-center my-4">
                  <span className="px-3 py-1 rounded-lg bg-[#1f2c33] text-xs text-gray-400">
                    {formatDateHeader(item.date)}
                  </span>
                </div>
              );
            }

            const msg = item as Message & { type: 'message'; isGroupStart: boolean };
            const isOwnMessage = msg.user_id === user?.id;
            
            return (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-2 mb-1",
                  isOwnMessage ? "flex-row-reverse" : "",
                  msg.isGroupStart ? "mt-3" : "mt-0.5"
                )}
              >
                {!isOwnMessage && msg.isGroupStart ? (
                  <Avatar className="h-8 w-8 flex-shrink-0 mt-1">
                    <AvatarImage src={msg.profiles?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs bg-emerald-600 text-white">
                      {getUserInitials(msg.profiles?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                ) : !isOwnMessage ? (
                  <div className="w-8 flex-shrink-0" />
                ) : null}
                
                <div className={cn(
                  "flex flex-col max-w-[75%]",
                  isOwnMessage ? "items-end" : "items-start"
                )}>
                  <div
                    className={cn(
                      "px-3 py-2 rounded-lg text-sm relative",
                      isOwnMessage
                        ? "bg-[#005c4b] text-white rounded-tr-none"
                        : "bg-[#1f2c33] text-white rounded-tl-none"
                    )}
                  >
                    {!isOwnMessage && msg.isGroupStart && (
                      <p className="text-xs font-medium text-emerald-400 mb-1">
                        {msg.profiles?.full_name || 'Unknown'}
                      </p>
                    )}
                    
                    {/* Image message */}
                    {msg.file_type === 'image' && msg.file_url && (
                      <div className="mb-1">
                        <img 
                          src={msg.file_url} 
                          alt="Shared image" 
                          className="max-w-full rounded-lg max-h-64 object-cover"
                        />
                      </div>
                    )}
                    
                    {/* Voice message */}
                    {msg.file_type === 'voice' && msg.file_url && (
                      <div className="flex items-center gap-3 min-w-[200px]">
                        <button
                          onClick={() => toggleAudioPlayback(msg.id, msg.file_url!)}
                          className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                        >
                          {playingAudioId === msg.id ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </button>
                        <div className="flex-1">
                          <div className="h-1 bg-white/20 rounded-full">
                            <div className="h-full w-0 bg-white/60 rounded-full"></div>
                          </div>
                        </div>
                        <span className="text-xs text-white/70">
                          {formatDuration(msg.voice_duration || 0)}
                        </span>
                      </div>
                    )}
                    
                    {/* Text message */}
                    {msg.message && (
                      <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                    )}
                    
                    <p className={cn(
                      "text-[10px] mt-1 text-right",
                      isOwnMessage ? "text-white/60" : "text-gray-500"
                    )}>
                      {formatMessageTime(new Date(msg.created_at))}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-[#1f2c33]">
        {isRecording ? (
          <div className="flex items-center gap-3 px-3 py-2 bg-[#0b141a] rounded-full">
            <button
              onClick={cancelRecording}
              className="p-2 rounded-full hover:bg-white/10 text-red-500"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex-1 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white text-sm">{formatDuration(recordingTime)}</span>
            </div>
            <button
              onClick={stopRecording}
              className="p-3 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />
            
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-full hover:bg-white/10 text-gray-400"
              disabled={sending}
            >
              <ImageIcon className="h-5 w-5" />
            </button>
            
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message"
              className="flex-1 bg-[#2a3942] border-0 rounded-full text-white placeholder:text-gray-500 focus-visible:ring-0"
              disabled={sending}
            />
            
            {newMessage.trim() ? (
              <button 
                type="submit" 
                disabled={sending}
                className="p-3 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50"
              >
                <Send className="h-5 w-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                disabled={sending}
                className="p-3 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50"
              >
                <Mic className="h-5 w-5" />
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}