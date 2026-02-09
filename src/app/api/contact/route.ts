import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { z } from 'zod';

const contactSchema = z.object({
    name: z.string().min(2, 'Nombre muy corto'),
    email: z.string().email('Email inválido'),
    phone: z.string().optional(),
    message: z.string().min(10, 'Mensaje muy corto'),
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const validatedData = contactSchema.parse(body);

        // Configurar transporte de email
        // En producción, usar variables de ambiente para credenciales
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        // Enviar email
        await transporter.sendMail({
            from: `"Xel Chile Website" <${process.env.SMTP_USER || 'noreply@xel.cl'}>`,
            to: 'contacto@xel.cl',
            replyTo: validatedData.email,
            subject: `[Contacto Web] Nuevo mensaje de ${validatedData.name}`,
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 10px;">
            Nuevo Mensaje de Contacto
          </h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold; width: 120px;">Nombre:</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${validatedData.name}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold;">Email:</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #eee;">
                <a href="mailto:${validatedData.email}">${validatedData.email}</a>
              </td>
            </tr>
            ${validatedData.phone ? `
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold;">Teléfono:</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #eee;">
                <a href="tel:${validatedData.phone}">${validatedData.phone}</a>
              </td>
            </tr>
            ` : ''}
          </table>
          <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
            <h3 style="margin: 0 0 10px 0; color: #1e3a5f;">Mensaje:</h3>
            <p style="margin: 0; white-space: pre-wrap;">${validatedData.message}</p>
          </div>
          <p style="margin-top: 20px; font-size: 12px; color: #666;">
            Este mensaje fue enviado desde el formulario de contacto de xel.cl
          </p>
        </div>
      `,
        });

        return NextResponse.json({ success: true, message: 'Mensaje enviado correctamente' });
    } catch (error) {
        console.error('Contact form error:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { success: false, message: 'Datos inválidos', errors: error.errors },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { success: false, message: 'Error al enviar el mensaje. Intente nuevamente.' },
            { status: 500 }
        );
    }
}
