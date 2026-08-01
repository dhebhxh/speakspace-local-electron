import { useEffect, useState } from "react";
import { KnowledgeTemplateCard } from "./components/KnowledgeTemplateCard";
import { KnowledgeTemplate } from "../../../main/entities/KnowledgeTemplate";
import { KnowledgeTemplateFormPage } from "./KnowledgeTemplateFormPage";


export function WorkflowPage() {

    const [knowledgeTemplates, setKnowledgeTemplates] = useState<KnowledgeTemplate[]>([]);

    const [pageMode, setPageMode] = useState<"list" | "create" | "edit">("list");

    const [editingTemplate, setEditingTemplate] = useState<KnowledgeTemplate | null>(null);

    useEffect(()=>{
        async function loadKnowledgeTemplates() {
            const knowledgeTemplateList = await window.electron.workflow.getKnowledgeTemplateList();
            setKnowledgeTemplates(knowledgeTemplateList);
        }
        loadKnowledgeTemplates();
    },[]);

    function handleUpdate(knowledgeTemplate: KnowledgeTemplate) {
        setEditingTemplate(knowledgeTemplate);
        setPageMode("edit");


    }

    function handleDelete(knowledgeTemplate: KnowledgeTemplate) {
        // Implement delete functionality here
    }

    function handleCreateTemplate() {
        setPageMode("create");
    }

    return (
        <div>
            {
                pageMode === "list" && 
                <>
                    <button onClick={handleCreateTemplate}>
                        create new knowledge template
                    </button>
                    {
                        knowledgeTemplates.map(
                            (knowledgeTemplate) => (
                                <KnowledgeTemplateCard
                                    key={knowledgeTemplate.getId()}
                                    knowledgeTemplate={knowledgeTemplate}
                                    onUpdate={handleUpdate}
                                    onDelete={handleDelete}
                                />
                            )
                        )
                    }
                </>
            }

            {
                pageMode === "create" &&
                <KnowledgeTemplateFormPage/>
            }

            {
                pageMode === "edit" &&
                <KnowledgeTemplateFormPage
                    
            }
        </div>
    )
}