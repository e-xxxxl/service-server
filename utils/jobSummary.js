// utils/jobSummary.js
// Jobs live inside Conversation documents, not a separate collection - a
// conversation's "quote" is the last paid (falling back to accepted) quote
// message, used to display service/amount info on job cards for both the
// provider and customer dashboards.
function getJobQuote(conversation) {
  const messages = conversation.messages || [];
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].messageType === 'quote' && messages[i].quote?.status === 'paid') return messages[i].quote;
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].messageType === 'quote' && messages[i].quote?.status === 'accepted') return messages[i].quote;
  }
  return null;
}

module.exports = { getJobQuote };
