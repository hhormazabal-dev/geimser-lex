'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  generateMagicLink, 
  getMagicLinks, 
  revokeMagicLink 
} from '@/lib/actions/magic-links';
import { formatRelativeTime, formatDateTime, isDateInPast } from '@/lib/utils';
import { 
  Link, 
  Plus, 
  Copy, 
  Trash2, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Mail,
  Calendar,
  User,
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react';
import type { MagicLink } from '@/lib/supabase/types';
import type { GenerateMagicLinkInput } from '@/lib/validators/magic-links';
import { MAGIC_LINK_PERMISSIONS, DEFAULT_EXPIRATION_HOURS } from '@/lib/validators/magic-links';

interface MagicLinkManagerProps {
  caseId: string;
  canManageLinks?: boolean;
}

export function MagicLinkManager({ caseId, canManageLinks = false }: MagicLinkManagerProps) {
  const [links, setLinks] = useState<MagicLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newLink, setNewLink] = useState({
    email: '',
    expires_in_hours: DEFAULT_EXPIRATION_HOURS,
    permissions: ['view_case', 'view_documents', 'view_timeline'] as string[],
  });
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const loadLinks = async () => {
    setIsLoading(true);
    try {
      const result = await getMagicLinks({ case_id: caseId, limit: 50 });
      
      if (result.success) {
        setLinks(result.magicLinks);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Error al cargar enlaces',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error loading magic links:', error);
      toast({
        title: 'Error',
        description: 'Error inesperado al cargar enlaces',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLinks();
  }, [caseId]);

  const handleCreateLink = async () => {
    if (!newLink.email.trim()) {
      toast({
        title: 'Error',
        description: 'El email es requerido',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const linkData: GenerateMagicLinkInput = {
        email: newLink.email.trim(),
        case_id: caseId,
        expires_in_hours: newLink.expires_in_hours,
        permissions: newLink.permissions as any[],
      };

      const result = await generateMagicLink(linkData);
      
      if (result.success && result.url) {
        toast({
          title: 'Enlace creado',
          description: 'El enlace de acceso ha sido generado exitosamente',
        });
        setGeneratedUrl(result.url);
        setNewLink({
          email: '',
          expires_in_hours: DEFAULT_EXPIRATION_HOURS,
          permissions: ['view_case', 'view_documents', 'view_timeline'],
        });
        await loadLinks();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Error al crear el enlace',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating magic link:', error);
      toast({
        title: 'Error',
        description: 'Error inesperado al crear el enlace',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevokeLink = async (linkId: string) => {
    if (!confirm('¿Estás seguro de que quieres revocar este enlace?')) {
      return;
    }

    try {
      const result = await revokeMagicLink(linkId);
      
      if (result.success) {
        toast({
          title: 'Enlace revocado',
          description: 'El enlace ha sido revocado exitosamente',
        });
        await loadLinks();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Error al revocar el enlace',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error revoking magic link:', error);
      toast({
        title: 'Error',
        description: 'Error inesperado al revocar el enlace',
        variant: 'destructive',
      });
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Copiado',
        description: 'El enlace ha sido copiado al portapapeles',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo copiar el enlace',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (link: MagicLink) => {
    const isExpired = isDateInPast(link.expires_at);
    const isRevoked = !!link.revoked_at;
    
    if (isRevoked) {
      return <Badge variant='destructive'>Revocado</Badge>;
    }
    
    if (isExpired) {
      return <Badge variant='secondary'>Expirado</Badge>;
    }
    
    if (link.is_used) {
      return <Badge variant='outline'>Usado</Badge>;
    }
    
    return <Badge className='bg-green-100 text-green-800'>Activo</Badge>;
  };

  const getPermissionLabels = (permissions: string[]) => {
    return permissions.map(perm => {
      const permission = MAGIC_LINK_PERMISSIONS.find(p => p.value === perm);
      return permission ? permission.label : perm;
    }).join(', ');
  };

  const handlePermissionChange = (permission: string, checked: boolean) => {
    if (checked) {
      setNewLink(prev => ({
        ...prev,
        permissions: [...prev.permissions, permission]
      }));
    } else {
      setNewLink(prev => ({
        ...prev,
        permissions: prev.permissions.filter(p => p !== permission)
      }));
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Link className='h-5 w-5' />
            Enlaces de Acceso Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex items-center justify-center py-8'>
            <Loader2 className='h-6 w-6 animate-spin' />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <CardTitle className='flex items-center gap-2'>
            <Link className='h-5 w-5' />
            Enlaces de Acceso Cliente ({links.length})
          </CardTitle>
          {canManageLinks && (
            <Button
              size='sm'
              onClick={() => setShowCreateForm(!showCreateForm)}
              disabled={isCreating}
            >
              <Plus className='h-4 w-4 mr-2' />
              Nuevo Enlace
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        {/* Formulario para nuevo enlace */}
        {showCreateForm && canManageLinks && (
          <Card className='border-dashed'>
            <CardContent className='pt-6'>
              <div className='space-y-4'>
                <div>
                  <label className='block text-sm font-medium mb-2'>
                    Email del Cliente *
                  </label>
                  <input
                    type='email'
                    value={newLink.email}
                    onChange={(e) => setNewLink({ ...newLink, email: e.target.value })}
                    placeholder='cliente@ejemplo.com'
                    className='form-input'
                  />
                </div>

                <div>
                  <label className='block text-sm font-medium mb-2'>
                    Duración del enlace (horas)
                  </label>
                  <select
                    value={newLink.expires_in_hours}
                    onChange={(e) => setNewLink({ ...newLink, expires_in_hours: parseInt(e.target.value) })}
                    className='form-input'
                  >
                    <option value={1}>1 hora</option>
                    <option value={6}>6 horas</option>
                    <option value={24}>24 horas</option>
                    <option value={72}>3 días</option>
                    <option value={168}>7 días</option>
                  </select>
                </div>

                <div>
                  <label className='block text-sm font-medium mb-2'>
                    Permisos
                  </label>
                  <div className='space-y-2'>
                    {MAGIC_LINK_PERMISSIONS.map(permission => (
                      <label key={permission.value} className='flex items-start gap-2'>
                        <input
                          type='checkbox'
                          checked={newLink.permissions.includes(permission.value)}
                          onChange={(e) => handlePermissionChange(permission.value, e.target.checked)}
                          className='mt-1'
                        />
                        <div>
                          <span className='text-sm font-medium'>{permission.label}</span>
                          <p className='text-xs text-gray-500'>{permission.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className='flex justify-end space-x-2'>
                  <Button
                    variant='outline'
                    onClick={() => {
                      setShowCreateForm(false);
                      setGeneratedUrl(null);
                      setNewLink({
                        email: '',
                        expires_in_hours: DEFAULT_EXPIRATION_HOURS,
                        permissions: ['view_case', 'view_documents', 'view_timeline'],
                      });
                    }}
                    disabled={isCreating}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateLink} disabled={isCreating}>
                    {isCreating ? (
                      <>
                        <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                        Generando...
                      </>
                    ) : (
                      'Generar Enlace'
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Enlace generado */}
        {generatedUrl && (
          <Card className='border-green-200 bg-green-50'>
            <CardContent className='pt-4'>
              <div className='flex items-center gap-2 mb-2'>
                <CheckCircle className='h-5 w-5 text-green-600' />
                <span className='font-medium text-green-900'>Enlace generado exitosamente</span>
              </div>
              <div className='bg-white rounded-lg p-3 border'>
                <div className='flex items-center justify-between'>
                  <code className='text-sm text-gray-700 break-all'>
                    {generatedUrl}
                  </code>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => copyToClipboard(generatedUrl)}
                  >
                    <Copy className='h-4 w-4' />
                  </Button>
                </div>
              </div>
              <p className='text-sm text-green-700 mt-2'>
                Comparte este enlace con el cliente para que pueda acceder al portal.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Lista de enlaces */}
        <div className='space-y-3'>
          {links.map((link) => (
            <Card key={link.id} className='border-l-4 border-l-blue-500'>
              <CardContent className='pt-4'>
                <div className='flex items-start justify-between mb-3'>
                  <div className='flex items-center gap-3'>
                    <Mail className='h-5 w-5 text-blue-600' />
                    <div>
                      <h4 className='font-medium text-gray-900'>
                        {link.email}
                      </h4>
                      <div className='flex items-center gap-2 mt-1'>
                        {getStatusBadge(link)}
                        {link.client_profile?.nombre && (
                          <Badge variant='outline'>
                            Cliente: {link.client_profile.nombre}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className='grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 mb-3'>
                  <div className='flex items-center gap-1'>
                    <Calendar className='h-4 w-4' />
                    <span>Creado: {formatRelativeTime(link.created_at)}</span>
                  </div>
                  
                  <div className='flex items-center gap-1'>
                    <Clock className='h-4 w-4' />
                    <span className={isDateInPast(link.expires_at) ? 'text-red-600 font-medium' : ''}>
                      Expira: {formatDateTime(link.expires_at)}
                    </span>
                  </div>

                  {link.created_by_profile?.nombre && (
                    <div className='flex items-center gap-1'>
                      <User className='h-4 w-4' />
                      <span>Por: {link.created_by_profile.nombre}</span>
                    </div>
                  )}

                  {link.used_at && (
                    <div className='flex items-center gap-1'>
                      <CheckCircle className='h-4 w-4' />
                      <span>Usado: {formatRelativeTime(link.used_at)}</span>
                    </div>
                  )}
                </div>

                <div className='mb-3'>
                  <p className='text-sm text-gray-600'>
                    <strong>Permisos:</strong> {getPermissionLabels(link.permissions || [])}
                  </p>
                </div>

                {canManageLinks && !link.revoked_at && !isDateInPast(link.expires_at) && (
                  <div className='flex items-center gap-2'>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => {
                        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
                        const url = `${baseUrl}/client-access?token=${link.token}`;
                        copyToClipboard(url);
                      }}
                    >
                      <Copy className='h-4 w-4 mr-1' />
                      Copiar Enlace
                    </Button>
                    
                    <Button
                      size='sm'
                      variant='ghost'
                      onClick={() => handleRevokeLink(link.id)}
                    >
                      <Trash2 className='h-4 w-4 mr-1' />
                      Revocar
                    </Button>
                  </div>
                )}

                {link.revoked_at && (
                  <div className='flex items-center gap-2 text-sm text-red-600'>
                    <AlertTriangle className='h-4 w-4' />
                    <span>Revocado {formatRelativeTime(link.revoked_at)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {links.length === 0 && (
          <div className='text-center py-8 text-gray-500'>
            <Link className='h-12 w-12 mx-auto mb-4 text-gray-300' />
            <p>No hay enlaces de acceso generados</p>
            {canManageLinks && (
              <p className='text-sm mt-2'>
                Haz clic en "Nuevo Enlace" para generar el primer enlace de acceso
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
