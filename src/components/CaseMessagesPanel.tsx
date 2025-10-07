'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { sendCaseMessage, listCaseMessages, type CaseMessageDTO } from '@/lib/actions/messages';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';
import { Loader2, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CaseMessagesPanelProps {
  caseId: string;
  initialMessages: CaseMessageDTO[];
  currentProfileId: string;
  allowSend?: boolean;
}

export function CaseMessagesPanel({ caseId, initialMessages, currentProfileId, allowSend = true }: CaseMessagesPanelProps) {
  const [messages, setMessages] = useState<CaseMessageDTO[]>(initialMessages);
  const [message, setMessage] = useState('');
  const [isPending, startTransition] = useTransition();
  const [isRefreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages, caseId]);

  useEffect(() => {
    if (initialMessages.length === 0) {
      refreshMessages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  const groupedMessages = useMemo(() => messages.slice().sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()), [messages]);

  const handleSend = () => {
    if (!message.trim()) {
      toast({
        title: 'Mensaje vacío',
        description: 'Escribe un mensaje antes de enviarlo.',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      try {
        const newMessage = await sendCaseMessage({
          caseId,
          contenido: message.trim(),
        });
        setMessages((prev) => [...prev, newMessage]);
        setMessage('');
      } catch (error: any) {
        toast({
          title: 'No se pudo enviar',
          description: error?.message ?? 'Intenta nuevamente en unos minutos.',
          variant: 'destructive',
        });
      }
    });
  };

  const refreshMessages = async () => {
    setRefreshing(true);
    try {
      const refreshed = await listCaseMessages(caseId, { limit: 100 });
      setMessages(refreshed);
    } catch (error: any) {
      toast({
        title: 'Error al actualizar',
        description: error?.message ?? 'No fue posible obtener los mensajes.',
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h3 className='text-lg font-semibold text-lexser-gray-900'>Mensajes del caso</h3>
        <Button variant='outline' size='sm' onClick={refreshMessages} disabled={isRefreshing}>
          {isRefreshing ? <Loader2 className='h-4 w-4 animate-spin' /> : 'Actualizar'}
        </Button>
      </div>

      <div className='space-y-4'>
        {groupedMessages.length === 0 ? (
          <p className='text-sm text-muted-foreground'>Aún no hay mensajes para este caso.</p>
        ) : (
          groupedMessages.map((msg) => {
            const isMine = msg.sender_profile_id === currentProfileId;
            return (
              <Card key={msg.id} className={`border ${isMine ? 'border-lexser-blue-200 bg-lexser-blue-50' : 'border-lexser-gray-100'}`}>
                <CardContent className='p-4 space-y-2'>
                  <div className='flex items-center justify-between text-xs text-muted-foreground'>
                    <span>
                      {msg.sender?.nombre ?? 'Usuario'}
                      {msg.sender?.role && (
                        <Badge variant='outline' className='ml-2 capitalize text-[10px]'>
                          {msg.sender.role}
                        </Badge>
                      )}
                    </span>
                    <span>{formatDateTime(msg.created_at)}</span>
                  </div>
                  <p className='text-sm text-lexser-gray-900 whitespace-pre-wrap'>{msg.contenido}</p>
                  {msg.attachment_url && (
                    <a
                      href={msg.attachment_url}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-xs font-medium text-lexser-blue-600 hover:text-lexser-blue-700'
                    >
                      Ver adjunto
                    </a>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {allowSend && (
        <div className='rounded-lg border border-lexser-gray-200 p-4 space-y-3'>
          <Textarea
            placeholder='Escribe un mensaje para tu cliente o equipo...'
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            disabled={isPending}
            className='min-h-[120px]'
          />
          <div className='flex items-center justify-end'>
            <Button onClick={handleSend} disabled={isPending}>
              {isPending ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : <Send className='mr-2 h-4 w-4' />}
              Enviar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
