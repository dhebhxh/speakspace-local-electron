import { KnowledgeTemplateRepository } from '../database/repositories/KnowledgeTemplateRepository';
import { KnowledgeTemplate } from '../entities/KnowledgeTemplate';
import { KnowledgeTemplateDTO } from './WorkflowTypes';

/** 模板 CRUD 的验证和 DTO 转换集中在主进程，Renderer 不接收类实例。 */
export default class WorkflowService {
  private readonly repository: KnowledgeTemplateRepository;

  public constructor(repository = new KnowledgeTemplateRepository()) {
    this.repository = repository;
  }

  public listTemplates(): KnowledgeTemplateDTO[] {
    return this.repository.findAll().map(WorkflowService.serializeTemplate);
  }

  public getTemplate(rawId: unknown): KnowledgeTemplateDTO | null {
    const template = this.repository.findById(
      WorkflowService.normalizeId(rawId),
    );
    return template ? WorkflowService.serializeTemplate(template) : null;
  }

  public createTemplate(
    rawName: unknown,
    rawPrompt: unknown,
  ): KnowledgeTemplateDTO {
    const name = WorkflowService.normalizeName(rawName);
    const prompt = WorkflowService.normalizePrompt(rawPrompt);
    const id = this.repository.create(name, prompt);
    return this.requireTemplate(id);
  }

  public updateTemplate(
    rawId: unknown,
    rawName: unknown,
    rawPrompt: unknown,
  ): KnowledgeTemplateDTO {
    const id = WorkflowService.normalizeId(rawId);
    const updated = this.repository.update(
      id,
      WorkflowService.normalizeName(rawName),
      WorkflowService.normalizePrompt(rawPrompt),
    );
    if (!updated) throw new Error('知识模板不存在 / Template not found');
    return this.requireTemplate(id);
  }

  public deleteTemplate(rawId: unknown): boolean {
    return this.repository.deleteById(WorkflowService.normalizeId(rawId));
  }

  private requireTemplate(id: number): KnowledgeTemplateDTO {
    const template = this.repository.findById(id);
    if (!template) throw new Error('知识模板不存在 / Template not found');
    return WorkflowService.serializeTemplate(template);
  }

  private static normalizeId(value: unknown): number {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error('无效的知识模板 ID / Invalid template ID');
    }
    return id;
  }

  private static normalizeName(value: unknown): string {
    const name = typeof value === 'string' ? value.trim() : '';
    if (!name) throw new Error('模板名称不能为空 / Template name is required');
    return name.slice(0, 80);
  }

  private static normalizePrompt(value: unknown): string {
    const prompt = typeof value === 'string' ? value.trim() : '';
    if (!prompt) throw new Error('模板提示词不能为空 / Prompt is required');
    if (prompt.length > 4000) throw new Error('模板提示词不能超过 4000 个字符');
    return prompt;
  }

  private static serializeTemplate(
    template: KnowledgeTemplate,
  ): KnowledgeTemplateDTO {
    return {
      id: template.getId(),
      name: template.getName(),
      prompt: template.getPrompt(),
      createdAt: template.getCreatedAt().toISOString(),
      updatedAt: template.getUpdatedAt().toISOString(),
    };
  }
}
