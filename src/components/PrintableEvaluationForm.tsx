import React from 'react';
import questionsErof from '../questions_erof.json';

const answerLines = (type: string) => {
  if (type === 'textarea') return 4;
  if (type === 'gps') return 2;
  return 1;
};

export default function PrintableEvaluationForm() {
  return (
    <article id="printable-evaluation-form" aria-hidden="true">
      <header className="print-form-cover">
        <p className="print-form-kicker">Formulaire officiel de collecte</p>
        <h1>Évaluation du fonctionnement des COGES</h1>
        <p>Version {questionsErof.version} · Exemplaire destiné à la collecte sur support papier</p>
        <div className="print-form-meta">
          <span>Nom de l’enquêteur : ................................................................</span>
          <span>Date : ........ / ........ / ................</span>
        </div>
        <p className="print-form-instructions">
          Cochez une seule réponse sauf indication contraire. Écrivez lisiblement dans les espaces prévus,
          puis reportez les réponses dans l’application.
        </p>
      </header>

      {questionsErof.sections.map((section: any) => (
        <section className="print-form-section" key={section.num}>
          <div className="print-form-section-title">
            <span>{section.num}</span>
            <div>
              <h2>{section.titre}</h2>
              {section.objectif && <p>{section.objectif}</p>}
            </div>
          </div>

          {section.intro && <p className="print-form-intro">{section.intro}</p>}

          {section.num === 16 && Array.isArray(section.repeat_instances) && (
            <div className="print-form-repeat-list">
              <strong>Postes à renseigner :</strong>{' '}
              {section.repeat_instances.map((item: any) => item.label || item.fonction).join(' · ')}
            </div>
          )}

          {(section.questions || []).map((question: any) => (
            <div className="print-form-question" key={question.code}>
              <div className="print-form-label">
                <strong>{question.code}</strong> {question.libelle}
                {question.required && <span className="print-required"> *</span>}
              </div>

              {Array.isArray(question.options) && question.options.length > 0 ? (
                <div className="print-form-options">
                  {question.options.map((option: any) => (
                    <span key={String(option.value)}><i /> {option.label}</span>
                  ))}
                </div>
              ) : (
                <div className="print-form-lines">
                  {Array.from({ length: answerLines(question.type) }).map((_, index) => <i key={index} />)}
                </div>
              )}

              {question.controle_coherence && (
                <p className="print-form-hint">Contrôle : {question.controle_coherence}</p>
              )}
            </div>
          ))}

          {section.repetable && (
            <p className="print-form-repeat-note">Dupliquer cette partie si plusieurs personnes ou éléments doivent être renseignés.</p>
          )}
        </section>
      ))}

      <footer className="print-form-signatures">
        <div>Signature de l’enquêteur</div>
        <div>Visa du responsable du COGES</div>
      </footer>
    </article>
  );
}
