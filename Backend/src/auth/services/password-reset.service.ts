import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from 'src/entities/user.entity';
import { MailingService } from 'src/infra/mail/send-mail.service';
import { UsersService } from 'src/modules/users/users.service';
import { Repository } from 'typeorm';
import { ResetPasswordDto } from '../dto/reset-password.dto';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly resetTokenExpirationMinutes = 60;
  private readonly bcryptSaltRounds = 10;

  constructor(
    private readonly usersService: UsersService,
    private readonly mailService: MailingService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async forgotPassword(email: string): Promise<{ message: string; success: boolean }> {
    try {
      const user = await this.usersService.findByEmail(email);
      if (!user) {
        return this.genericForgotPasswordResponse();
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      user.resetPasswordToken = this.hashToken(resetToken);
      user.resetPasswordExpires = new Date(
        Date.now() + this.resetTokenExpirationMinutes * 60 * 1000,
      );
      await this.userRepo.save(user);

      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
      await this.mailService.sendEmail({
        from: process.env.PROJECT_EMAIL || 'noreply@foodee.com',
        to: email,
        subject: 'Password Reset Request - Foodee',
        sender: 'Foodee Support',
        bodyHtml: this.createPasswordResetEmailContent(user.name || 'User', resetUrl),
      });

      return this.genericForgotPasswordResponse();
    } catch (error) {
      this.logger.error(`Failed to send password reset email: ${(error as Error).message}`);
      throw new BadRequestException('Failed to process password reset request');
    }
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string; success: boolean }> {
    const { token, email, newPassword } = resetPasswordDto;

    try {
      const user = await this.findUserByResetToken(email, token);
      if (!user) {
        throw new BadRequestException('Invalid or expired reset token');
      }

      if (!user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
        throw new BadRequestException('Reset token has expired');
      }

      user.password = await bcrypt.hash(newPassword, this.bcryptSaltRounds);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = new Date();
      await this.userRepo.save(user);

      await this.sendPasswordChangeConfirmationEmail(user.email, user.name || 'User');

      return {
        message: 'Password has been reset successfully',
        success: true,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Password reset failed: ${(error as Error).message}`);
      throw new BadRequestException('Failed to reset password');
    }
  }

  async verifyResetToken(token: string, email: string): Promise<any> {
    try {
      const user = await this.findUserByResetToken(email, token);
      if (!user) {
        return { valid: false, message: 'Invalid reset token' };
      }

      if (!user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
        return { valid: false, message: 'Reset token has expired' };
      }

      return {
        valid: true,
        message: 'Token is valid',
        expiresAt: user.resetPasswordExpires,
      };
    } catch (error) {
      this.logger.error(`Token verification failed: ${(error as Error).message}`);
      return { valid: false, message: 'Token verification failed' };
    }
  }

  private async findUserByResetToken(email: string, token: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: {
        email,
        resetPasswordToken: this.hashToken(token),
      },
    });
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private genericForgotPasswordResponse(): { message: string; success: boolean } {
    return {
      message: 'If an account with this email exists, you will receive password reset instructions.',
      success: true,
    };
  }

  private createPasswordResetEmailContent(userName: string, resetUrl: string): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset - Foodee</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #ff6b35; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background-color: #f9f9f9; }
            .button {
                display: inline-block;
                background-color: #ff6b35;
                color: white;
                padding: 12px 30px;
                text-decoration: none;
                border-radius: 5px;
                margin: 20px 0;
            }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
            .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Foodee</h1>
                <h2>Password Reset Request</h2>
            </div>

            <div class="content">
                <h3>Hello ${userName},</h3>
                <p>We received a request to reset your password for your Foodee account. If you didn't make this request, you can safely ignore this email.</p>
                <p>To reset your password, click the button below:</p>
                <div style="text-align: center;">
                    <a href="${resetUrl}" class="button">Reset My Password</a>
                </div>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; background-color: #f0f0f0; padding: 10px; border-radius: 3px;">
                    ${resetUrl}
                </p>
                <div class="warning">
                    <strong>Important:</strong>
                    <ul>
                        <li>This link will expire in 1 hour for security reasons</li>
                        <li>You can only use this link once</li>
                        <li>If you didn't request this reset, please ignore this email</li>
                    </ul>
                </div>
                <p>Best regards,<br>The Foodee Team</p>
            </div>

            <div class="footer">
                <p>This email was sent because a password reset was requested for your Foodee account.</p>
                <p>Foodee. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  private async sendPasswordChangeConfirmationEmail(email: string, userName: string): Promise<void> {
    const emailContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Changed - Foodee</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background-color: #f9f9f9; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
            .success { background-color: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Foodee</h1>
                <h2>Password Successfully Changed</h2>
            </div>
            <div class="content">
                <h3>Hello ${userName},</h3>
                <div class="success">
                    <strong>Success!</strong> Your password has been successfully changed.
                </div>
                <p>Your Foodee account password was recently changed on ${new Date().toLocaleString()}.</p>
                <p>If you did not make this change, please contact support immediately.</p>
                <p>Best regards,<br>The Foodee Team</p>
            </div>
            <div class="footer">
                <p>Foodee. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    `;

    try {
      await this.mailService.sendEmail({
        from: process.env.PROJECT_EMAIL || 'noreply@foodee.com',
        to: email,
        subject: 'Password Successfully Changed - Foodee',
        sender: 'Foodee Support',
        bodyHtml: emailContent,
      });
    } catch (error) {
      this.logger.error(`Failed to send password change confirmation: ${(error as Error).message}`);
    }
  }
}
