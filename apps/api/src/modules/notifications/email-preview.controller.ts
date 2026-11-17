import { EMAIL_TEMPLATES, type EmailTemplate } from '@hongwang/shared';
import { Controller, Get, Inject, Param, Query, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../../common/auth';
import { notFound } from '../../common/errors';
import { ENV, type Env } from '../../config/env';
import { escapeHtml, isEmailTemplate, renderEmail, type RenderedEmail } from './templates';
import { emailSamples, type EmailSample } from './templates/samples';

/**
 * Dev-only email preview (404 in production):
 *   GET /notifications/dev/preview                         index of every template and variant
 *   GET /notifications/dev/preview/:template               the HTML email with sample data
 *       ?variant=hold|by-host|...  &format=html|text|json
 */
@ApiExcludeController()
@Public()
@Controller('notifications/dev/preview')
export class EmailPreviewController {
  constructor(@Inject(ENV) private readonly env: Env) {}

  @Get()
  index(@Req() req: Request, @Res() res: Response) {
    this.assertDev();
    const base = req.originalUrl.split('?')[0]!.replace(/\/+$/, '');
    const samples = emailSamples(this.env.WEB_ORIGIN);
    const items = EMAIL_TEMPLATES.map((template) => {
      const variants = (samples[template] as readonly EmailSample<EmailTemplate>[]).map((s) => {
        const href = `${base}/${template}?variant=${encodeURIComponent(s.variant)}`;
        const { subject } = renderEmail(template, s.data);
        return (
          `<li><a href="${escapeHtml(href)}">${escapeHtml(s.variant)}</a> ` +
          `<span class="muted">${escapeHtml(subject)}</span> ` +
          `<a class="small" href="${escapeHtml(`${href}&format=text`)}">text</a></li>`
        );
      });
      return `<section><h2>${escapeHtml(template)}</h2><ul>${variants.join('')}</ul></section>`;
    });
    res.type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Email previews</title>
<style>
body{margin:0;padding:32px 16px;background:#F6F7F5;color:#142020;font:15px/1.5 Inter,system-ui,sans-serif}
main{max-width:720px;margin:0 auto}h1{margin:0 0 4px;font-size:24px}h2{margin:24px 0 6px;font-size:16px}
ul{margin:0;padding-left:20px}li{margin:4px 0}a{color:#0F6B63}.muted{color:#5A6664}.small{font-size:13px}
</style></head>
<body><main><h1>Email previews</h1><p class="muted">Sample data, rendered by the same templates the email worker uses. Dev only.</p>
${items.join('\n')}
</main></body></html>`);
  }

  @Get(':template')
  preview(
    @Param('template') template: string,
    @Query('variant') variant: string | undefined,
    @Query('format') format: string | undefined,
    @Res() res: Response,
  ) {
    this.assertDev();
    if (!isEmailTemplate(template)) throw notFound('Email template');
    const samples = emailSamples(this.env.WEB_ORIGIN)[template] as readonly EmailSample<EmailTemplate>[];
    const sample = variant ? samples.find((s) => s.variant === variant) : samples[0];
    if (!sample) throw notFound('Sample variant');
    const email: RenderedEmail = renderEmail(template, sample.data);

    if (format === 'text') return res.type('text/plain; charset=utf-8').send(`Subject: ${email.subject}\n\n${email.text}`);
    if (format === 'json') return res.json({ template, variant: sample.variant, ...email });
    return res.type('html').send(email.html);
  }

  private assertDev() {
    if (this.env.NODE_ENV === 'production') throw notFound();
  }
}
