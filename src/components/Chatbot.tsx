import { useState, useRef, useEffect } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Send, Bot, User, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'bot';
  content: string;
}

export default function Chatbot({ students, analytics, session }: { students: any[], analytics: any, session: any }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', content: 'Hello! I am your SmartAttend AI assistant. How can I help you with the attendance data today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const currentPresentCount = session?.presentStudents?.length || 0;
      const currentAbsentees = students?.filter(s => 
        !session?.presentStudents?.some((id: any) => (id._id || id) === s._id)
      ) || [];
      
      const context = `
        Attendance Data Summary:
        - Students Enrolled: ${students?.length || 0}
        - Students Present: ${currentPresentCount}
        - Students Absent: ${currentAbsentees.length}
        - Absent Names: ${currentAbsentees.slice(0, 10).map(s => s.name).join(', ')}
      `;

      console.log("Sending chat request...");
      const response = await api.post('/chat', {
        message: userMessage,
        context: context
      });

      const botResponse = response.data.text || "I'm sorry, I couldn't process that request.";
      setMessages(prev => [...prev, { role: 'bot', content: botResponse }]);
    } catch (err: any) {
      console.error('Chatbot error:', err);
      setMessages(prev => [...prev, { role: 'bot', content: "Sorry, I'm having trouble connecting to my brain right now. Please try again later." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="formal-card h-[600px] flex flex-col border-white/5 bg-black/40 overflow-hidden shadow-2xl">
      <CardHeader className="border-b border-white/5 bg-white/[0.02] flex flex-row items-center gap-4 py-4 px-6">
        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-xl shadow-primary/10 border border-primary/20">
          <Bot size={24} />
        </div>
        <div>
          <CardTitle className="text-xl font-heading text-primary font-black">Neural Assistant</CardTitle>
          <CardDescription className="text-sm text-foreground font-mono uppercase tracking-widest font-black">Knowledge Base: 100% Sync</CardDescription>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 min-h-0 p-0 bg-gradient-to-b from-transparent to-black/30">
        <ScrollArea className="h-full w-full">
          <div className="p-6 space-y-6">
            {messages.map((m, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-4 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${m.role === 'user' ? 'bg-white/10 text-foreground border border-white/20' : 'bg-primary text-primary-foreground'}`}>
                    {m.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                  </div>
                  <div className={`p-4 rounded-2xl text-sm leading-relaxed ${m.role === 'user' ? 'bg-white/[0.05] text-white rounded-tr-none border border-white/10' : 'bg-primary/10 text-foreground rounded-tl-none border border-primary/20'}`}>
                    <div className="prose prose-sm prose-invert max-w-none font-medium">
                      <ReactMarkdown>
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex gap-4 items-center">
                  <div className="w-8 h-8 rounded-xl bg-primary/20 text-primary flex items-center justify-center animate-[pulse_2s_infinite]">
                    <Bot size={14} />
                  </div>
                  <div className="flex gap-2">
                    <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </CardContent>

      <CardFooter className="p-6 border-t border-white/5 bg-black/20">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex gap-3 w-full h-14"
        >
          <div className="relative flex-1 group">
            <Input 
              placeholder="Inquire with the AI core..." 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              className="w-full h-full bg-black/40 border-white/5 text-foreground focus:border-primary focus:ring-primary/20 rounded-2xl px-6 transition-all group-hover:border-white/10"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-20 group-focus-within:opacity-0 transition-opacity">
               <MessageSquare size={16} />
            </div>
          </div>
          <Button 
            type="submit" 
            disabled={isLoading || !input.trim()} 
            className="aspect-square h-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95"
          >
            <Send size={20} />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
