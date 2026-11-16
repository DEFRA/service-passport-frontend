import {
  approveEverything,
  askAboutStep,
  confirmAnswers,
  confirmCondition,
  saveCondition,
  saveEvidence,
  saveGoLive,
  saveQuestion,
  saveService,
  saveStatus,
  showCheck,
  showCondition,
  showEvidence,
  showGoLive,
  showGuidance,
  showPassport,
  showPlan,
  showQuestion,
  showRecord,
  showService,
  showShare,
  showStatus,
  showStep,
  simulateDecision,
  startAgain,
  startPage,
  timePasses
} from './controllers.js'

/**
 * One delivery lead's journey with one service: pick it, give a go-live
 * date, check what AI found, then work through each step to release.
 */
const journey = {
  plugin: {
    name: 'journey',
    register(server) {
      server.route(
        [
          ['GET', '/', startPage],
          ['POST', '/start-again', startAgain],
          ['GET', '/about-your-service', showService],
          ['POST', '/about-your-service', saveService],
          ['GET', '/about-your-service/go-live', showGoLive],
          ['POST', '/about-your-service/go-live', saveGoLive],
          ['GET', '/about-your-service/check', showCheck],
          ['POST', '/about-your-service/check', confirmAnswers],
          ['GET', '/about-your-service/{questionId}', showQuestion],
          ['POST', '/about-your-service/{questionId}', saveQuestion],
          ['GET', '/plan', showPlan],
          ['GET', '/passport', showPassport],
          ['GET', '/passport/share', showShare],
          ['POST', '/passport/time-passes', timePasses],
          ['POST', '/passport/approve-everything', approveEverything],
          ['GET', '/passport/{stepId}', showStep],
          ['POST', '/passport/{stepId}/ask', askAboutStep],
          ['GET', '/passport/{stepId}/status', showStatus],
          ['POST', '/passport/{stepId}/status', saveStatus],
          ['POST', '/passport/{stepId}/decision', simulateDecision],
          ['GET', '/passport/{stepId}/record', showRecord],
          ['GET', '/passport/{stepId}/evidence', showEvidence],
          ['POST', '/passport/{stepId}/evidence', saveEvidence],
          ['GET', '/passport/{stepId}/conditions/{index}', showCondition],
          ['POST', '/passport/{stepId}/conditions/{index}', saveCondition],
          [
            'POST',
            '/passport/{stepId}/conditions/{index}/confirm',
            confirmCondition
          ],
          ['GET', '/guidance/{slug}', showGuidance]
        ].map(([method, path, handler]) => ({ method, path, handler }))
      )
    }
  }
}

export { journey }
