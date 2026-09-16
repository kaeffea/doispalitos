<?php

namespace App\Mail;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ManagerAccessMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Tenant $tenant,
        public User $user,
        public string $password,
        public bool $isReset = false
    ) {}

    public function envelope(): Envelope
    {
        $subject = $this->isReset 
            ? "Nova senha de acesso // {$this->tenant->name} (Dois Palitos)"
            : "Acesso Liberado // Painel do Gestor da {$this->tenant->name}";

        return new Envelope(
            subject: $subject,
        );
    }

    public function content(): Content
    {
        return new Content(
            htmlString: $this->buildHtml(),
        );
    }

    private function buildHtml(): string
    {
        $frontendUrl = rtrim(config('app.frontend_url', 'https://app.doispalitos.tech'), '/');
        $loginUrl = $frontendUrl . '/login';
        $domain = config('app.domain', 'doispalitos.tech');
        $menuHost = $this->tenant->custom_domain ?: ($this->tenant->slug . '.' . $domain);
        $menuUrl = 'https://' . $menuHost;

        $title = $this->isReset 
            ? 'Sua nova senha de acesso provisória' 
            : 'Seu restaurante está pronto para operar!';

        $intro = $this->isReset
            ? "Uma nova senha temporária de acesso foi gerada para o seu usuário gestor no restaurante <strong>" . htmlspecialchars($this->tenant->name) . "</strong>."
            : "Sua conta de gestor principal no restaurante <strong>" . htmlspecialchars($this->tenant->name) . "</strong> foi criada com sucesso na plataforma Dois Palitos.";

        $userName = htmlspecialchars($this->user->name ?: 'Gestor');
        $userEmail = htmlspecialchars($this->user->email);
        $safePassword = htmlspecialchars($this->password);

        return "
        <!DOCTYPE html>
        <html lang=\"pt-BR\">
        <head>
            <meta charset=\"UTF-8\">
            <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
            <title>{$title}</title>
        </head>
        <body style=\"margin: 0; padding: 0; background-color: #F4F4F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;\">
            <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color: #F4F4F5; padding: 40px 16px;\">
                <tr>
                    <td align=\"center\">
                        <!-- Main Container -->
                        <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width: 560px; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; border: 1px solid #E4E4E7; box-shadow: 0 1px 3px rgba(0,0,0,0.04);\">
                            
                            <!-- Brand Accent Bar -->
                            <tr>
                                <td style=\"height: 5px; background-color: #F5DC55;\"></td>
                            </tr>

                            <!-- Header -->
                            <tr>
                                <td style=\"padding: 32px 36px 20px 36px;\">
                                    <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">
                                        <tr>
                                            <td>
                                                <div style=\"display: inline-flex; align-items: center;\">
                                                    <span style=\"display: inline-block; width: 10px; height: 10px; background-color: #F5DC55; border-radius: 50%; margin-right: 10px; vertical-align: middle;\"></span>
                                                    <span style=\"font-size: 15px; font-weight: 800; letter-spacing: 2px; color: #18181B; text-transform: uppercase; vertical-align: middle;\">DOIS PALITOS</span>
                                                </div>
                                            </td>
                                            <td align=\"right\">
                                                <span style=\"font-size: 11px; font-family: 'Courier New', monospace; text-transform: uppercase; color: #71717A; letter-spacing: 1px;\">
                                                    PORTAL DO GESTOR
                                                </span>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>

                            <!-- Divider -->
                            <tr>
                                <td style=\"padding: 0 36px;\">
                                    <div style=\"height: 1px; background-color: #F4F4F5;\"></div>
                                </td>
                            </tr>

                            <!-- Content Body -->
                            <tr>
                                <td style=\"padding: 28px 36px;\">
                                    <h1 style=\"margin: 0 0 14px 0; font-size: 22px; font-weight: 700; color: #18181B; line-height: 1.3;\">
                                        {$title}
                                    </h1>
                                    
                                    <p style=\"margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #52525B;\">
                                        Olá, <strong>{$userName}</strong>. {$intro}
                                    </p>

                                    <!-- First Access Alert Box -->
                                    <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color: #FEFCE8; border: 1px solid #FEF08A; border-radius: 8px; margin-bottom: 24px;\">
                                        <tr>
                                            <td style=\"padding: 14px 18px;\">
                                                <p style=\"margin: 0; font-size: 13px; line-height: 1.5; color: #713F12;\">
                                                    <strong>Definição de Senha no Primeiro Acesso:</strong> Esta é uma senha provisória. Por segurança, assim que fizer login no painel, você deverá cadastrar sua nova senha definitiva pessoal para desbloquear o sistema.
                                                </p>
                                            </td>
                                        </tr>
                                    </table>

                                    <!-- Credentials Box -->
                                    <div style=\"background-color: #FAFAFA; border: 1px solid #E4E4E7; border-radius: 8px; padding: 20px; margin-bottom: 28px;\">
                                        <div style=\"font-size: 11px; font-family: 'Courier New', monospace; font-weight: 700; text-transform: uppercase; color: #71717A; letter-spacing: 1px; margin-bottom: 14px;\">
                                            Suas Credenciais de Acesso
                                        </div>

                                        <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">
                                            <tr>
                                                <td style=\"padding-bottom: 12px; font-size: 13px; color: #71717A; width: 130px; vertical-align: top;\">
                                                    E-mail de Login:
                                                </td>
                                                <td style=\"padding-bottom: 12px; font-size: 14px; color: #18181B; font-weight: 600; font-family: 'Courier New', monospace;\">
                                                    {$userEmail}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style=\"padding-bottom: 12px; font-size: 13px; color: #71717A; vertical-align: middle;\">
                                                    Senha Temporária:
                                                </td>
                                                <td style=\"padding-bottom: 12px;\">
                                                    <span style=\"display: inline-block; background-color: #F5DC55; color: #18181B; font-family: 'Courier New', monospace; font-size: 16px; font-weight: 700; padding: 4px 12px; border-radius: 6px; letter-spacing: 1.5px;\">
                                                        {$safePassword}
                                                    </span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style=\"padding-top: 4px; font-size: 13px; color: #71717A; vertical-align: top;\">
                                                    Cardápio Público:
                                                </td>
                                                <td style=\"padding-top: 4px; font-size: 13px;\">
                                                    <a href=\"{$menuUrl}\" target=\"_blank\" style=\"color: #18181B; text-decoration: underline; font-family: 'Courier New', monospace;\">
                                                        {$menuHost}
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>
                                    </div>

                                    <!-- CTA Button -->
                                    <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin-bottom: 24px;\">
                                        <tr>
                                            <td align=\"center\">
                                                <a href=\"{$loginUrl}\" target=\"_blank\" style=\"display: inline-block; width: 100%; box-sizing: border-box; background-color: #18181B; color: #FFFFFF; font-size: 14px; font-weight: 600; text-align: center; text-decoration: none; padding: 14px 28px; border-radius: 8px; letter-spacing: 0.5px;\">
                                                    Acessar Painel do Gestor &rarr;
                                                </a>
                                            </td>
                                        </tr>
                                    </table>

                                    <p style=\"margin: 0; font-size: 12px; line-height: 1.5; color: #A1A1AA; text-align: center;\">
                                        Se o botão acima não funcionar, copie e cole o link abaixo em seu navegador:<br>
                                        <a href=\"{$loginUrl}\" target=\"_blank\" style=\"color: #71717A; text-decoration: underline; font-family: 'Courier New', monospace; font-size: 11px;\">{$loginUrl}</a>
                                    </p>
                                </td>
                            </tr>

                            <!-- Footer -->
                            <tr>
                                <td style=\"background-color: #FAFAFA; border-top: 1px solid #E4E4E7; padding: 24px 36px; text-align: center;\">
                                    <p style=\"margin: 0 0 6px 0; font-size: 12px; color: #71717A;\">
                                        Plataforma Dois Palitos &copy; " . date('Y') . " &bull; Soluções para Gastronomia
                                    </p>
                                    <p style=\"margin: 0; font-size: 11px; color: #A1A1AA;\">
                                        Dúvidas ou suporte: <a href=\"mailto:suporte@doispalitos.tech\" style=\"color: #71717A; text-decoration: none;\">suporte@doispalitos.tech</a>
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        ";
    }
}
