'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, User, Bot, CheckCircle2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

type Message = {
    id: string;
    sender: 'bot' | 'user';
    text: string;
};

type Step = 'none' | 'name' | 'email' | 'phone' | 'done';

export const LawyerBotWidget: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            sender: 'bot',
            text: '¡Hola! ¿Te interesa implementar Xel en tu estudio jurídico? ¿Cuál es tu nombre para comenzar?'
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [step, setStep] = useState<Step>('name');
    const [isTyping, setIsTyping] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: ''
    });

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    const addMessage = (text: string, sender: 'bot' | 'user') => {
        setMessages(prev => [...prev, { id: Date.now().toString(), sender, text }]);
    };

    const botTypingAndRespond = (text: string, delay: number = 800) => {
        setIsTyping(true);
        setTimeout(() => {
            setIsTyping(false);
            addMessage(text, 'bot');
        }, delay);
    };

    const handleSend = async () => {
        const text = inputValue.trim();
        if (!text || step === 'done') return;

        // Add user message
        addMessage(text, 'user');
        setInputValue('');

        if (step === 'name') {
            setFormData(prev => ({ ...prev, name: text }));
            setStep('email');
            botTypingAndRespond(`¡Mucho gusto, ${text}! ¿A qué correo electrónico te podemos escribir?`);
        } else if (step === 'email') {
            if (!/^\S+@\S+\.\S+$/.test(text)) {
                botTypingAndRespond('Por favor, ingresa un correo electrónico válido.');
                return;
            }
            setFormData(prev => ({ ...prev, email: text }));
            setStep('phone');
            botTypingAndRespond('Perfecto. Por último, ¿cuál es tu número de teléfono (o WhatsApp)?');
        } else if (step === 'phone') {
            const finalData = { ...formData, phone: text };
            setFormData(finalData);
            setStep('done');

            // Send data to backend concurrently with bot typing
            setIsTyping(true);
            try {
                await fetch('/api/lawyer-leads', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(finalData)
                });

                setIsTyping(false);
                addMessage('¡Todo listo! Hemos recibido tus datos. Nos contactaremos contigo en un plazo máximo de 24 horas hábiles para coordinar una demo.', 'bot');
            } catch (error) {
                setIsTyping(false);
                addMessage('Ocurrió un error al enviar tus datos. ¿Podrías intentar de nuevo más tarde?', 'bot');
                setStep('phone'); // allow retry
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSend();
        }
    };

    return (
        <>
            {/* Floating Button */}
            <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: isOpen ? 0 : 1 }}
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-50 w-16 h-16 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-blue-700 transition-colors"
            >
                <MessageSquare className="w-7 h-7" />
            </motion.button>

            {/* Chat Window */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="fixed bottom-6 right-6 z-50 w-full max-w-[360px] h-[500px] bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="bg-blue-600 p-4 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                                    <Bot className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-semibold">Consultor Xel</h3>
                                    <p className="text-blue-100 text-xs flex items-center gap-1">
                                        <span className="w-2 h-2 bg-green-400 rounded-full inline-block animate-pulse"></span>
                                        En línea
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`flex gap-2 max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.sender === 'user' ? 'bg-blue-100 text-blue-700' : 'bg-blue-600 text-white'
                                            }`}>
                                            {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                                        </div>
                                        <div className={`p-3 rounded-2xl ${msg.sender === 'user'
                                                ? 'bg-blue-600 text-white rounded-tr-none'
                                                : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'
                                            }`}>
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {isTyping && (
                                <div className="flex justify-start">
                                    <div className="flex gap-2 max-w-[85%]">
                                        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                                            <Bot className="w-4 h-4" />
                                        </div>
                                        <div className="p-4 bg-white border border-slate-200 rounded-2xl rounded-tl-none flex gap-1 items-center">
                                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white border-t border-slate-100">
                            {step === 'done' ? (
                                <div className="flex items-center justify-center gap-2 text-green-600 py-2">
                                    <CheckCircle2 className="w-5 h-5" />
                                    <span className="text-sm font-medium">Información enviada</span>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Escribe tu respuesta..."
                                        disabled={isTyping}
                                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:opacity-50"
                                    />
                                    <button
                                        onClick={handleSend}
                                        disabled={!inputValue.trim() || isTyping}
                                        className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:hover:bg-blue-600"
                                    >
                                        <Send className="w-5 h-5" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};
