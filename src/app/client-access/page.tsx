'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { 
  validateMagicLink, 
  createClientFromMagicLink, 
  authenticateWithMagicLink 
} from '@/lib/actions/magic-links';
import { formatRUT } from '@/lib/utils';
import { Loader2, CheckCircle, AlertCircle, User, Scale } from 'lucide-react';
import type { MagicLink, Case } from '@/lib/supabase/types';

export default function ClientAccessPage() {
  const [step, setStep] = useState<'validating' | 'registration' | 'success' | 'error'>('validating');
  const [magicLink, setMagicLink] = useState<MagicLink | null>(null);
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    rut: '',
  });
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('Token de acceso no proporcionado');
      setStep('error');
      return;
    }

    validateToken();
  }, [token]);

  const validateToken = async () => {
    if (!token) return;

    try {
      const result = await validateMagicLink({ token });
      
      if (result.success && result.magicLink) {
        setMagicLink(result.magicLink);
        setCaseData(result.case);
        
        // Intentar autenticar directamente
        const authResult = await authenticateWithMagicLink(token);
        
        if (authResult.success) {
          if (authResult.needsRegistration) {
            // Pre-llenar el nombre del cliente si está disponible
            if (result.case?.nombre_cliente) {
              setFormData(prev => ({ ...prev, nombre: result.case.nombre_cliente }));
            }
            setStep('registration');
          } else {
            // Cliente ya existe, redirigir al portal
            if (authResult.sessionUrl) {
              window.location.href = authResult.sessionUrl;
            } else {
              setStep('success');
            }
          }
        } else {
          setError(authResult.error || 'Error de autenticación');
          setStep('error');
        }
      } else {
        setError(result.error || 'Token inválido');
        setStep('error');
      }
    } catch (error) {
      console.error('Error validating token:', error);
      setError('Error inesperado al validar el token');
      setStep('error');
    }
  };

  const handleRegistration = async () => {
    if (!formData.nombre.trim()) {
      toast({
        title: 'Error',
        description: 'El nombre es requerido',
        variant: 'destructive',
      });
      return;
    }

    if (!token) {
      setError('Token no disponible');
      return;
    }

    setIsLoading(true);
    try {
      const result = await createClientFromMagicLink({
        token,
        nombre: formData.nombre.trim(),
        telefono: formData.telefono.trim() || undefined,
        rut: formData.rut.trim() || undefined,
      });

      if (result.success) {
        toast({
          title: 'Registro exitoso',
          description: 'Tu cuenta ha sido creada exitosamente',
        });
        
        // Autenticar al cliente recién creado
        const authResult = await authenticateWithMagicLink(token);
        if (authResult.success && authResult.sessionUrl) {
          window.location.href = authResult.sessionUrl;
        } else {
          setStep('success');
        }
      } else {
        setError(result.error || 'Error al crear la cuenta');
        setStep('error');
      }
    } catch (error) {
      console.error('Error creating client:', error);
      setError('Error inesperado al crear la cuenta');
      setStep('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedRut = formatRUT(e.target.value);
    setFormData(prev => ({ ...prev, rut: formattedRut }));
  };

  if (step === 'validating') {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8'>
        <Card className='w-full max-w-md'>
          <CardContent className='pt-6'>
            <div className='text-center'>
              <Loader2 className='mx-auto h-12 w-12 animate-spin text-blue-600' />
              <h2 className='mt-4 text-lg font-medium text-gray-900'>
                Validando acceso...
              </h2>
              <p className='mt-2 text-sm text-gray-600'>
                Por favor espera mientras verificamos tu enlace de acceso
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8'>
        <Card className='w-full max-w-md'>
          <CardContent className='pt-6'>
            <div className='text-center'>
              <AlertCircle className='mx-auto h-12 w-12 text-red-600' />
              <h2 className='mt-4 text-lg font-medium text-gray-900'>
                Error de Acceso
              </h2>
              <p className='mt-2 text-sm text-gray-600'>
                {error || 'No se pudo validar tu enlace de acceso'}
              </p>
              <div className='mt-6'>
                <Button
                  onClick={() => router.push('/login')}
                  variant='outline'
                  className='w-full'
                >
                  Ir al Login
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8'>
        <Card className='w-full max-w-md'>
          <CardContent className='pt-6'>
            <div className='text-center'>
              <CheckCircle className='mx-auto h-12 w-12 text-green-600' />
              <h2 className='mt-4 text-lg font-medium text-gray-900'>
                Acceso Exitoso
              </h2>
              <p className='mt-2 text-sm text-gray-600'>
                Has accedido exitosamente al portal cliente
              </p>
              <div className='mt-6'>
                <Button
                  onClick={() => router.push('/client-portal')}
                  className='w-full'
                >
                  Ir al Portal Cliente
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8'>
      <Card className='w-full max-w-md'>
        <CardHeader className='text-center'>
          <div className='mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100'>
            <Scale className='h-6 w-6 text-blue-600' />
          </div>
          <CardTitle className='mt-4 text-xl font-semibold text-gray-900'>
            Bienvenido a LEXCHILE
          </CardTitle>
          <p className='mt-2 text-sm text-gray-600'>
            Completa tu información para acceder al portal cliente
          </p>
        </CardHeader>
        
        <CardContent>
          {caseData && (
            <div className='mb-6 p-4 bg-blue-50 rounded-lg'>
              <h3 className='font-medium text-blue-900'>Información del Caso</h3>
              <p className='text-sm text-blue-700 mt-1'>
                {caseData.caratulado}
              </p>
              {caseData.abogado_responsable?.nombre && (
                <p className='text-sm text-blue-600 mt-1'>
                  Abogado: {caseData.abogado_responsable.nombre}
                </p>
              )}
            </div>
          )}

          <div className='space-y-4'>
            <div>
              <Label htmlFor='nombre'>Nombre Completo *</Label>
              <div className='mt-1 relative'>
                <Input
                  id='nombre'
                  type='text'
                  value={formData.nombre}
                  onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder='Tu nombre completo'
                  className='pl-10'
                  disabled={isLoading}
                />
                <User className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />
              </div>
            </div>

            <div>
              <Label htmlFor='telefono'>Teléfono (opcional)</Label>
              <Input
                id='telefono'
                type='tel'
                value={formData.telefono}
                onChange={(e) => setFormData(prev => ({ ...prev, telefono: e.target.value }))}
                placeholder='+56 9 1234 5678'
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor='rut'>RUT (opcional)</Label>
              <Input
                id='rut'
                type='text'
                value={formData.rut}
                onChange={handleRutChange}
                placeholder='12.345.678-9'
                disabled={isLoading}
              />
            </div>

            <Button
              onClick={handleRegistration}
              disabled={isLoading || !formData.nombre.trim()}
              className='w-full'
            >
              {isLoading ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Creando cuenta...
                </>
              ) : (
                'Acceder al Portal'
              )}
            </Button>
          </div>

          <div className='mt-6 text-center'>
            <p className='text-xs text-gray-500'>
              Al continuar, aceptas acceder al portal cliente de LEXCHILE para revisar la información de tu caso legal.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
