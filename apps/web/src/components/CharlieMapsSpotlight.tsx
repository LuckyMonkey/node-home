import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { faArrowUpRightFromSquare, faRotateRight } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { ServiceCard } from '../lib/types';

function statusTone(status: ServiceCard['status']) {
  if (status === 'running') {
    return 'bg-lime-100 text-lime-900 border-lime-300/80';
  }
  if (status === 'degraded') {
    return 'bg-amber-100 text-amber-950 border-amber-300/80';
  }
  if (status === 'stopped') {
    return 'bg-rose-100 text-rose-950 border-rose-300/80';
  }
  return 'bg-slate-100 text-slate-700 border-slate-300/80';
}

function actionLabel(service: ServiceCard) {
  return service.resolvedUrl ? 'Open map' : 'Open repo';
}

export function CharlieMapsSpotlight({
  service,
  onOpen,
  onAction,
  onHover
}: {
  service: ServiceCard;
  onOpen: (service: ServiceCard) => void;
  onAction: (serviceId: string, action: 'start' | 'stop' | 'restart') => void;
  onHover: () => void;
}) {
  return (
    <section className="mt-3 rounded-[1.25rem] border border-black/10 bg-[linear-gradient(135deg,rgba(187,247,208,0.9)_0%,rgba(191,219,254,0.92)_52%,rgba(254,240,138,0.86)_100%)] p-3 shadow-[0_18px_38px_rgba(15,23,42,0.08),0_4px_14px_rgba(15,23,42,0.06)] sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-[38rem]">
          <div className="text-[0.64rem] font-black uppercase tracking-[0.22em] text-black/50">Map spotlight</div>
          <h3 className="mt-1 text-[1.15rem] font-black tracking-[-0.03em] text-black/88 sm:text-[1.3rem]">{service.name}</h3>
          <p className="mt-1 text-[0.85rem] font-medium text-black/68">
            Live launch into the current CharlieMaps build with the EXIF splatter layer and map workbench.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.7rem] font-black uppercase tracking-[0.14em] text-black/58">
            <span className={`rounded-full border px-2.5 py-1 ${statusTone(service.status)}`}>{service.status}</span>
            <span className="rounded-full border border-black/10 bg-white/72 px-2.5 py-1">{service.containerNames?.length ?? 0} containers</span>
            {service.resolvedUrl ? (
              <span className="rounded-full border border-black/10 bg-white/72 px-2.5 py-1 normal-case tracking-normal text-[0.72rem] font-semibold">
                {service.resolvedUrl}
              </span>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:min-w-[12rem]">
          <button
            type="button"
            onClick={() => onOpen(service)}
            onPointerEnter={onHover}
            className="rounded-[1rem] border border-black/15 bg-black px-4 py-3 text-left text-[0.78rem] font-black uppercase tracking-[0.16em] text-white transition-transform hover:-translate-y-0.5"
          >
            <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="mr-2" />
            {actionLabel(service)}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onAction(service.id, 'restart')}
              onPointerEnter={onHover}
              className="rounded-[0.9rem] border border-black/12 bg-white/82 px-3 py-2 text-[0.72rem] font-black uppercase tracking-[0.14em] text-black/70"
            >
              <FontAwesomeIcon icon={faRotateRight} className="mr-2" />
              Restart
            </button>
            <a
              href={service.githubUrl ?? '#'}
              target="_blank"
              rel="noreferrer"
              onPointerEnter={onHover}
              className={`rounded-[0.9rem] border border-black/12 bg-white/82 px-3 py-2 text-center text-[0.72rem] font-black uppercase tracking-[0.14em] text-black/70 ${
                service.githubUrl ? '' : 'pointer-events-none opacity-40'
              }`}
            >
              <FontAwesomeIcon icon={faGithub} className="mr-2" />
              Repo
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
