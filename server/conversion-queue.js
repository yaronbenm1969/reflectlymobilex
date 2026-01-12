const EventEmitter = require('events');

class ConversionQueue extends EventEmitter {
  constructor(options = {}) {
    super();
    this.maxConcurrent = options.maxConcurrent || 3;
    this.queue = [];
    this.activeJobs = new Map();
    this.completedJobs = new Map();
    this.jobCounter = 0;
    this.stats = {
      totalProcessed: 0,
      totalFailed: 0,
      averageProcessingTime: 0
    };
  }

  generateJobId() {
    return `job_${Date.now()}_${++this.jobCounter}`;
  }

  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      activeJobs: this.activeJobs.size,
      maxConcurrent: this.maxConcurrent,
      availableSlots: Math.max(0, this.maxConcurrent - this.activeJobs.size),
      stats: this.stats,
      jobs: {
        queued: this.queue.map(j => ({ id: j.id, type: j.type, createdAt: j.createdAt })),
        active: Array.from(this.activeJobs.values()).map(j => ({ 
          id: j.id, 
          type: j.type, 
          startedAt: j.startedAt,
          progress: j.progress || 0
        })),
        recentCompleted: Array.from(this.completedJobs.values())
          .slice(-10)
          .map(j => ({ 
            id: j.id, 
            type: j.type, 
            status: j.status,
            duration: j.duration
          }))
      }
    };
  }

  getJobStatus(jobId) {
    if (this.activeJobs.has(jobId)) {
      const job = this.activeJobs.get(jobId);
      return { status: 'processing', progress: job.progress || 0, position: 0 };
    }
    
    const queuePosition = this.queue.findIndex(j => j.id === jobId);
    if (queuePosition !== -1) {
      return { status: 'queued', position: queuePosition + 1, estimatedWait: (queuePosition + 1) * 30 };
    }
    
    if (this.completedJobs.has(jobId)) {
      const job = this.completedJobs.get(jobId);
      return { 
        status: job.status, 
        result: job.result, 
        error: job.error,
        duration: job.duration
      };
    }
    
    return { status: 'not_found' };
  }

  async addJob(type, data, processor) {
    const jobId = this.generateJobId();
    
    const job = {
      id: jobId,
      type,
      data,
      processor,
      createdAt: new Date().toISOString(),
      progress: 0,
      resolve: null,
      reject: null
    };

    const promise = new Promise((resolve, reject) => {
      job.resolve = resolve;
      job.reject = reject;
    });

    this.queue.push(job);
    console.log(`📥 Job ${jobId} added to queue (position: ${this.queue.length}, type: ${type})`);
    
    this.emit('jobAdded', { jobId, type, queueLength: this.queue.length });
    
    this.processNext();
    
    return { jobId, promise };
  }

  async processNext() {
    if (this.activeJobs.size >= this.maxConcurrent) {
      console.log(`⏳ Queue at capacity (${this.activeJobs.size}/${this.maxConcurrent}), waiting...`);
      return;
    }

    if (this.queue.length === 0) {
      return;
    }

    const job = this.queue.shift();
    job.startedAt = new Date();
    this.activeJobs.set(job.id, job);
    
    console.log(`🚀 Starting job ${job.id} (active: ${this.activeJobs.size}/${this.maxConcurrent}, queued: ${this.queue.length})`);
    this.emit('jobStarted', { jobId: job.id, type: job.type });

    try {
      const updateProgress = (progress) => {
        job.progress = progress;
        this.emit('jobProgress', { jobId: job.id, progress });
      };

      const result = await job.processor(job.data, updateProgress);
      
      const duration = Date.now() - job.startedAt.getTime();
      this.stats.totalProcessed++;
      this.stats.averageProcessingTime = 
        (this.stats.averageProcessingTime * (this.stats.totalProcessed - 1) + duration) / this.stats.totalProcessed;
      
      this.completedJobs.set(job.id, {
        id: job.id,
        type: job.type,
        status: 'completed',
        result,
        duration,
        completedAt: new Date().toISOString()
      });
      
      if (this.completedJobs.size > 100) {
        const oldestKey = this.completedJobs.keys().next().value;
        this.completedJobs.delete(oldestKey);
      }
      
      console.log(`✅ Job ${job.id} completed in ${duration}ms`);
      this.emit('jobCompleted', { jobId: job.id, result, duration });
      
      job.resolve(result);
      
    } catch (error) {
      const duration = Date.now() - job.startedAt.getTime();
      this.stats.totalFailed++;
      
      this.completedJobs.set(job.id, {
        id: job.id,
        type: job.type,
        status: 'failed',
        error: error.message,
        duration,
        completedAt: new Date().toISOString()
      });
      
      console.error(`❌ Job ${job.id} failed after ${duration}ms:`, error.message);
      this.emit('jobFailed', { jobId: job.id, error: error.message, duration });
      
      job.reject(error);
      
    } finally {
      this.activeJobs.delete(job.id);
      this.processNext();
    }
  }

  cancelJob(jobId) {
    const queueIndex = this.queue.findIndex(j => j.id === jobId);
    if (queueIndex !== -1) {
      const [job] = this.queue.splice(queueIndex, 1);
      job.reject(new Error('Job cancelled'));
      console.log(`🚫 Job ${jobId} cancelled from queue`);
      return true;
    }
    return false;
  }

  clearQueue() {
    const count = this.queue.length;
    this.queue.forEach(job => job.reject(new Error('Queue cleared')));
    this.queue = [];
    console.log(`🧹 Cleared ${count} jobs from queue`);
    return count;
  }
}

const conversionQueue = new ConversionQueue({ maxConcurrent: 3 });

conversionQueue.on('jobAdded', ({ jobId, queueLength }) => {
  console.log(`📊 Queue status: ${queueLength} jobs waiting`);
});

conversionQueue.on('jobStarted', ({ jobId }) => {
  console.log(`📊 Active conversions: ${conversionQueue.activeJobs.size}`);
});

module.exports = { ConversionQueue, conversionQueue };
