require("module-alias/register")

const path = require("path");
const fs = require("fs").promises;

const { s1Auth } = require("@util/require");
const { callClient } = require("@util/mwareUtil");
const { AppError } = require("@shared/utils/Handler");
const { CatchAsync } = require("@util/errHandler")

const protect = CatchAsync(async(req, res, next) => {
    const sessionCookie = req.cookies.session;
    if (!sessionCookie) return next(new AppError("Not authenticated. Please login.", 401));

    const result = await callClient(s1Auth, "verifyUser", { sessionCookie });
    if (!result) return next(new AppError("Invalid session", 401));

    req.user = {
        id: result.userData.id,
        email: result.userData.email,
        name: result.userData.name
    };

    if (result.sessionCookie) {
        res.cookie("session", result.sessionCookie, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 24 * 60 * 60 * 1000
        });
    }

    next()
})

// first thing to done: req.files deletion
// second as we save req.grpc (for images saved as it is but for pdf we convert into imsages and save exactly there)
//  now at this point handling saved files 
// still have to work with pdf 
const autoCleanup = (req, res, next) => {
    // We define the cleanup logic inside the middleware
    const cleanup = async () => {
        const filesToDelete = new Set(); // Use a Set to prevent trying to delete the same file twice
        try {
            // Remove the event listeners immediately so this function doesn't run twice
            res.removeListener('finish', cleanup);
            res.removeListener('close', cleanup);
    
            if (req.skipCleanup) return;
    
    
            // 1. Gather original Multer files (if they haven't been deleted yet)
            if (req.files && Array.isArray(req.files)) {
                req.files.forEach(f => {
                    if (f.path) {
                        filesToDelete.add(path.join(__dirname, "../../", f.path)); 
                    }
                });
            }
    
            // 2. Gather the generated PNGs/S2 files
            if (req.grpcFiles && Array.isArray(req.grpcFiles)) {
                req.grpcFiles.forEach(f => {
                    if (f.path) {
                        filesToDelete.add(path.join(f.path)); 
                    }
                });
            }

            // 3. Nuke them from the hard drive silently
            if (filesToDelete.size > 0) {
                const deletePromises = Array.from(filesToDelete).map(filePath => 
                    fs.unlink(filePath).catch(() => {}) // Catch prevents crashes if the file was already deleted
                );
                
                await Promise.all(deletePromises);
            } 
    
            
        } catch (error) {
            console.error("Error during cleanup:", error);   
        }
    };

    // Attach the listeners!
    // 'finish' fires when response is sent.
    // 'close' fires on any error.
    res.on('finish', cleanup);
    res.on('close', cleanup);

    // Continue to the next middleware
    next();
};

// ROUTER TO VERIFY INTERNAL REQUESTS
const verifyInternalRequest = (req, res, next) => {
    const secret = req.headers['x-internal-secret'];
    // Use a strong, random string stored in your .env file
    if (secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
        return res.status(403).json({ error: "Forbidden: Internal only" });
    }
    next();
};

module.exports = { protect, autoCleanup, verifyInternalRequest };